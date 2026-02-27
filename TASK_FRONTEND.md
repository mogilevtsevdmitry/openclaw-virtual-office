# TASK_FRONTEND.md — Задачи Макса
> Порядок строгий. Зависимости от Backend указаны явно.

---

## ЭТАП 3: Frontend Implementation

### F1. Базовая настройка (приоритет: КРИТИЧНО)
**Что сделать:**
- Установить зависимости:
  ```bash
  npm install phaser zustand socket.io-client react-router-dom axios
  ```
- Настроить `vite.config.ts`: proxy `/api` → `http://localhost:3000`
- Структура директорий:
  ```
  apps/frontend/src/
    pages/          ← роуты
    components/     ← переиспользуемые
    scenes/         ← Phaser scenes
    stores/         ← Zustand stores
    api/            ← axios clients
    hooks/          ← custom hooks
    types/          ← shared TS types
  ```
- TypeScript strict mode: `tsconfig.json`

**Зависимости от Backend:** нет

---

### F2. Auth UI (приоритет: КРИТИЧНО)
**Что сделать:**
- Страницы: `LoginPage`, `RegisterPage`
- `AuthStore` (Zustand): `{ token, user, login(), logout(), refresh() }`
- `authApi.ts`: POST `/auth/login`, POST `/auth/register`, POST `/auth/refresh`
- Route guard: `ProtectedRoute` — redirect на `/login` если нет токена
- Auto-refresh: interceptor Axios — на 401 делает refresh

**Зависимости от Backend:** B1

---

### F3. WS клиент (приоритет: ВЫСОКИЙ)
**Что сделать:**
- `useWsConnection()` hook: подключение к `/realtime`, JWT в handshake
- `WsStore` (Zustand): состояние подключения, очередь событий
- Типизация: `WsEvent<T>` из DECISIONS M5
- Обработчики: `presence.state_changed`, `message.created`, `desk.placed`
- Reconnect: автоматический с экспоненциальным backoff

**Зависимости от Backend:** B7

---

### F4. OfficeScene — Phaser (приоритет: ВЫСОКИЙ)
**Что сделать:**
- `OfficeScene.ts` extends `Phaser.Scene`
- Рендер этажа: `FloorRenderer` — рисует зоны через `Phaser.GameObjects.Graphics`
- Цвета зон:
  ```
  WORK    → #4A90D9 (синий)
  REST    → #7ED321 (зелёный)
  SMOKING → #9B9B9B (серый)
  FINANCE → #F5A623 (оранжевый)
  ```
- Агент-аватар: цветной кружок + инициал имени
- Перемещение агентов: `Phaser.Tweens.add` (1 сек, ease: 'Sine.easeInOut')
- При `desk.placed` WS event → перерисовать desk
- При `presence.state_changed` WS event → обновить цвет аватара по состоянию:
  ```
  IDLE     → #CCCCCC
  WORKING  → #4A90D9
  RESTING  → #7ED321
  SMOKING  → #9B9B9B
  CHATTING → #F8E71C
  ```
- Масштаб: Canvas 1280×720, max 50 аватаров

**Зависимости от Backend:** B3, B4, F3

---

### F5. Панель агентов (приоритет: СРЕДНИЙ)
**Что сделать:**
- `AgentListPanel`: sidebar со списком агентов тенанта
- `AgentCard`: имя, отдел, текущий статус (badge)
- `agentsApi.ts`: GET `/agents`, GET `/agents/:id`
- Click на агента → highlight на карте (Phaser camera focus)

**Зависимости от Backend:** B2, F4

---

### F6. Chat UI (приоритет: СРЕДНИЙ)
**Что сделать:**
- `ChatPanel`: правый sidebar
- `ChatRoomList`: список комнат
- `MessageFeed`: read-only scroll (пользователь только читает!)
- WS subscription: `message.created` → append в feed
- `chatApi.ts`: GET `/chat-rooms`, GET `/chat-rooms/:id/messages`
- Пагинация: infinite scroll вверх (старые сообщения)

**Зависимости от Backend:** B5, F3

---

### F7. Floor Switcher (приоритет: НИЗКИЙ)
**Что сделать:**
- `FloorDropdown`: выбор активного этажа
- В MVP всегда один активный этаж
- Dropdown готов UI-шно, но переключение — пост-MVP (disabled остальные)
- `officeApi.ts`: GET `/floors`

**Зависимости от Backend:** B3

---

### F8. Layout итоговый
**Что сделать:**
- `AppLayout`:
  ```
  [AgentListPanel | OfficeCanvas | ChatPanel]
  [         FloorDropdown (top bar)         ]
  ```
- Responsive: min-width 1280px, только десктоп
- Dark theme (фон #1E1E2E)

**Зависимости от Backend:** нет

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

```
F1 (setup) → F2 (auth) → F3 (WS) → F8 (layout) → F4 (OfficeScene) → F5 (agents) → F6 (chat) → F7 (floors)
```
