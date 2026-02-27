# DECISIONS.md — Архитектурные решения
> Автор: Ваня (Senior Backend Architect)  
> Дата: 2026-02-26  
> Статус: УТВЕРЖДЕНО — можно кодить

---

## 🔵 РЕШЕНИЯ ПО ВОПРОСАМ ФЕДИ

### F1. Prisma 5 или 7?
**Решение: Prisma 5 (оставляем ^5.22.0)**  
Причина: уже установлена, стабильная, 11 таблиц с миграцией работают. Prisma 7 — слишком сырая для MVP. Апгрейд отложен на пост-MVP.

### F2. Права БД (friday + CREATEDB)
**Решение: оставляем как есть для dev**  
CREATEDB нужен для `prisma migrate dev`. В prod — отдельный пользователь без CREATEDB. Для MVP окей.

### F3. Bounded Contexts — модули или отдельные apps?
**Решение: модули внутри `apps/backend/src/modules/`**  
Смотрю на уже созданные отдельные apps (agent-lifecycle, audit, communication, office-layout, presence, realtime-gateway) — это Федя заготовил, но для MVP это overhead.  
Подход: каждый BC = NestJS Module внутри основного backend. Отдельные apps — только если понадобится отдельное масштабирование (пост-MVP).

**Итоговая структура модулей:**
```
apps/backend/src/modules/
  health/
  realtime/          ← уже есть
  auth/              ← JWT auth
  agents/            ← BC: AgentLifecycle
  office/            ← BC: OfficeLayout (floors, zones, objects)
  presence/          ← BC: Presence
  communication/     ← BC: Communication (messages, chat-rooms)
  audit/             ← BC: Audit (events, outbox, inbox)
```

### F4. Phaser.js нужен?
**Решение: ДА, Phaser.js подключаем**  
Макс явно сказал — нужен для OfficeScene. Программатический рендер геометрии через Phaser Graphics API. Спрайты не нужны. Версия: Phaser 3.x.

### F5. Reverse proxy сейчас?
**Решение: НЕТ для MVP**  
Dev-окружение: frontend на 5173, backend на 3000. Nginx/Caddy — только при деплое на prod (Этап 4 Феди). Для MVP CORS настройки в NestJS достаточно.

---

## 🟡 РЕШЕНИЯ ВАНИ (Backend)

### Q1. Двойная политика Presence
**Решение: Presence инициализируется ТОЛЬКО через событие `DeskPlaced`**  
Прямое создание Presence через API запрещено. Flow:  
`POST /office/desk → DeskPlaced event → PresenceModule создаёт запись → статус IDLE`

### Q2. OpenClaw Core ACL
**Решение: stub-адаптер для MVP**  
Интерфейс `IAclAdapter` в domain. Реализация `StubAclAdapter` — всегда возвращает `true`. Реальный адаптер — пост-MVP.

### Q3. JWT аутентификация
**Решение: простой JWT (email + password), без внешнего IDP**  
Stack: `@nestjs/jwt` + `bcrypt`. Access token (15 мин) + Refresh token (7 дней, httpOnly cookie). Без OAuth, без SAML.

### Q4. TypeORM vs Prisma
**Решение: Prisma** (уже решено, зафиксируем)

### Q5. Квоты тенанта
**Решение:**
- Агентов: **100 на тенант**
- Этажей: **5 на тенант**
- Отделов: **20 на тенант**

Квоты проверяются в Application Service перед созданием. Guard `TenantQuotaGuard`.

### Q6. State machine Presence

**Состояния:** `IDLE | WORKING | RESTING | SMOKING | CHATTING`

**Матрица переходов:**
```
IDLE       → WORKING, CHATTING
WORKING    → RESTING, SMOKING, CHATTING, IDLE
RESTING    → WORKING, CHATTING, IDLE
SMOKING    → WORKING, CHATTING, IDLE
CHATTING   → WORKING, RESTING, SMOKING, IDLE
```
**Правила:**
- IDLE — начальное состояние (после DeskPlaced)
- Переходы вне матрицы — `DomainException: InvalidPresenceTransition`
- Domain Event на каждый переход: `PresenceStateChanged`

### Q7. Пользователь в чате
**Решение: пользователь только наблюдает в MVP**  
Пользователь может читать сообщения в чат-румах. Писать могут только агенты. UI: read-only chat feed.

### Q8. WS масштаб
**Решение: до 50 одновременных подключений в MVP**  
Single instance, in-memory Socket.IO rooms. Redis adapter — пост-MVP.

### Q9. Тайлы
**Решение: программатический рендер — геометрия и цвет, без спрайтов**  
Phaser Graphics API. Каждый тип зоны = цвет + форма. Никаких ассетов.

### Q10. DepartmentManifest
**Решение: хардкод 4 типов:**
```typescript
enum DepartmentType {
  WORK    = 'WORK',
  REST    = 'REST',
  SMOKING = 'SMOKING',
  FINANCE = 'FINANCE',
}
```
Расширение через конфиг — пост-MVP.

### Q11. AgentDepartureCleanup
**Решение: soft-delete без компенсации в MVP**  
При увольнении агента: `isActive = false`, Presence переходит в IDLE, desk освобождается. Нет saga, нет rollback.

### Q12. Retention Audit
**Решение: 90 дней**  
Записи в `events`, `outbox`, `inbox` старше 90 дней — удаляются cron-джобой (ежедневно в 03:00).

---

## 🟢 РЕШЕНИЯ ЗА МАКСА (Frontend)

### M1. Тайлсеты
**Решение: программатический рендер (Phaser Graphics API)**  
Никаких тайлсет-файлов. Геометрия: прямоугольники, цвет по типу зоны.

### M2. Масштаб на этаже
**Решение: до 50 агентов на этаже**  
Аватары — простые цветные кружки с буквой имени. Анимации базовые (Phaser Tween).

### M3. Мобайл
**Решение: только десктоп (min-width: 1280px)**  
Адаптив не нужен для MVP.

### M4. Многоэтажность
**Решение: один активный этаж на тенант**  
Переключение этажей — пост-MVP. В UI — dropdown для будущего.

### M5. WS-протокол
**Решение: JSON-конверт:**
```typescript
interface WsEvent {
  eventId: string;       // uuid v4
  eventType: string;     // e.g. 'presence.state_changed'
  payload: object;       // BC-specific data
  tenantId: string;
  occurredAt: string;    // ISO 8601
}
```

---

## 📌 ИТОГОВЫЙ СТЕК

| Слой | Технология |
|------|-----------|
| Backend | NestJS 10, TypeScript strict |
| ORM | Prisma 5 |
| DB | PostgreSQL 15 |
| Auth | JWT (access 15m + refresh 7d) |
| WS | Socket.IO (namespace: /realtime) |
| Frontend | React 18 + Vite |
| Canvas | Phaser 3 |
| State | Zustand |
| Proxy | — (MVP) / Nginx (prod) |
