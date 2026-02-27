# TASK_BACKEND.md — Задачи Вани
> Порядок строгий. Каждый пункт — отдельный PR / коммит.

---

## ЭТАП 2: Domain + Application Layer

### B1. Модуль `auth` (приоритет: КРИТИЧНО)
**Что кодить:**
- `apps/backend/src/modules/auth/`
- Domain VO: `Email`, `Password` (bcrypt hash)
- Entity: `User { id, email, passwordHash, tenantId, role }`
- Use cases: `RegisterUser`, `LoginUser`, `RefreshToken`
- Infrastructure: `UserPrismaRepository`
- Controller: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`
- Guard: `JwtAuthGuard` (глобальный)
- Prisma schema: добавить таблицу `users`

**Зависимости:** нет  
**Команды:** `@nestjs/jwt`, `bcrypt`, `@nestjs/passport`, `passport-jwt`

---

### B2. Модуль `agents` — BC: AgentLifecycle (приоритет: ВЫСОКИЙ)
**Что кодить:**
- `apps/backend/src/modules/agents/`
- Aggregate Root: `Agent { id, name, tenantId, departmentId, isActive, ... }`
- VO: `AgentName`, `TenantId`, `DepartmentId`
- Domain Events: `AgentCreated`, `AgentDeactivated`
- Use cases: `CreateAgent`, `DeactivateAgent`, `GetAgent`, `ListAgents`
- Repository: `IAgentRepository` (interface) + `AgentPrismaRepository`
- Guard: `TenantQuotaGuard` (проверка: max 100 агентов)
- Controller: CRUD `/agents`

**Зависимости:** B1 (JWT guard)

---

### B3. Модуль `office` — BC: OfficeLayout (приоритет: ВЫСОКИЙ)
**Что кодить:**
- `apps/backend/src/modules/office/`
- Aggregates: `Floor { id, tenantId, name, layoutJson }`, `Zone { id, floorId, type, bounds }`, `Desk { id, zoneId, agentId? }`
- VO: `ZoneType` (enum), `Bounds { x, y, width, height }`
- Domain Events: `DeskPlaced`, `DeskRemoved`
- Use cases: `CreateFloor`, `AddZone`, `PlaceDesk`, `RemoveDesk`
- `DeskPlaced` → публикует в EventEmitter → слушает PresenceModule
- Guard: `TenantQuotaGuard` (max 5 этажей)
- Controller: `/floors`, `/zones`, `/desks`

**Зависимости:** B1, B2

---

### B4. Модуль `presence` — BC: Presence (приоритет: ВЫСОКИЙ)
**Что кодить:**
- `apps/backend/src/modules/presence/`
- Aggregate: `Presence { agentId, deskId, state: PresenceState, updatedAt }`
- VO: `PresenceState` (enum + матрица переходов из DECISIONS.md Q6)
- Domain Service: `PresenceStateMachine.transition(from, to): void | throw`
- Domain Event: `PresenceStateChanged { agentId, from, to, occurredAt }`
- Use case: `ChangePresenceState`, `GetPresence`
- Listener: `@OnEvent('desk.placed') → InitializePresence`
- Controller: `PATCH /presence/:agentId/state`, `GET /presence/:agentId`

**Зависимости:** B3 (DeskPlaced event)

---

### B5. Модуль `communication` — BC: Communication (приоритет: СРЕДНИЙ)
**Что кодить:**
- `apps/backend/src/modules/communication/`
- Entities: `ChatRoom { id, tenantId, name, participants: AgentId[] }`, `Message { id, roomId, authorAgentId, content, createdAt }`
- Use cases: `CreateChatRoom`, `SendMessage`, `GetMessages` (pagination)
- Rule: только агенты пишут (проверка `isAgent` в use case)
- Controller: `/chat-rooms`, `/chat-rooms/:id/messages`
- WS emit: при новом сообщении → `realtime.emit('message.created', WsEvent)`

**Зависимости:** B1, B2

---

### B6. Модуль `audit` — BC: Audit (приоритет: НИЗКИЙ)
**Что кодить:**
- `apps/backend/src/modules/audit/`
- `AuditEvent { id, tenantId, eventType, payload, occurredAt }`
- Listener: `@OnEvent('*')` → пишет в таблицу `events`
- Cron: `@Cron('0 3 * * *')` → удаляет записи старше 90 дней
- `OutboxRelay`: периодически читает `outbox`, эмитит в WS
- Controller: `GET /audit/events` (только admin)

**Зависимости:** B1

---

### B7. WS интеграция (приоритет: ВЫСОКИЙ)
**Что кодить:**
- Расширить `RealtimeGateway`:
  - Аутентификация по JWT в WS handshake
  - Rooms по tenantId: `socket.join(tenantId)`
  - Emit `WsEvent` конверт (см. DECISIONS M5)
  - Events: `presence.state_changed`, `message.created`, `agent.created`, `desk.placed`
- Утилита: `WsEventFactory.create(type, payload, tenantId): WsEvent`

**Зависимости:** B1, B4, B5

---

### B8. Tenant Quota Guard
**Что кодить:**
- `apps/backend/src/common/guards/tenant-quota.guard.ts`
- Параметризованный decorator: `@CheckQuota('agents', 100)`
- Реализация: перед use case читает count из Prisma → если превышен → `ForbiddenException`

**Зависимости:** B1

---

### B9. Тесты (после B1-B7)
**Что кодить:**
- Unit: `PresenceStateMachine` — все переходы из матрицы
- Unit: `Agent` aggregate — инварианты
- Unit: `TenantQuotaGuard` — лимиты
- Integration: auth flow (register → login → protected route)
- E2E: presence flow (desk placed → state change → WS emit)

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

```
B1 (auth) → B8 (quota) → B2 (agents) → B3 (office) → B4 (presence) → B7 (WS) → B5 (communication) → B6 (audit) → B9 (tests)
```
