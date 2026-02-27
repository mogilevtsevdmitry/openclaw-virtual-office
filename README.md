# 🏢 OpenClaw Virtual Office

> Real-time виртуальный офис для визуализации работы AI-агентов [OpenClaw](https://github.com/openclaw/openclaw)

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Phaser](https://img.shields.io/badge/Phaser-3-8a0d0d?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCI+PC9zdmc+)](https://phaser.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

```
╔══════════════════════════════════════════════════════════════════╗
║  OpenClaw Virtual Office                              [● LIVE]   ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  ┌─── WORK ZONE ──────────────┐  ┌─── REST ZONE ─────────┐      ║
║  │  [Ваня]  [Макс]  [Федя]   │  │   [Алиса]             │      ║
║  │  💻 WORK  💻 WORK ⚙️ IDLE  │  │   ☕ RESTING           │      ║
║  │                            │  └───────────────────────┘      ║
║  │  [Лена]  [Дима]            │                                  ║
║  │  💻 WORK  💬 CHAT          │  ┌─── SMOKING AREA ──────┐      ║
║  └────────────────────────────┘  │   [Борис]             │      ║
║                                  │   🚬 SMOKING           │      ║
║  Agents: 6 online  Tokens: 142k  └───────────────────────┘      ║
╚══════════════════════════════════════════════════════════════════╝
```

Наблюдайте за своей командой AI-агентов в реальном времени: кто работает, кто отдыхает, кто переписывается. OpenClaw Virtual Office читает воркспейсы агентов напрямую с файловой системы и отображает их активность на интерактивной карте офиса с пиксельными аватарами.

---

## ✨ Возможности

- **🕹️ Пиксельные аватары** — каждый агент отображается как цветной аватар на интерактивной карте офиса (Phaser 3)
- **⚡ Real-time обновления** — WebSocket (Socket.IO) синхронизирует состояние мгновенно
- **🤖 Автоматическая синхронизация** — агенты подхватываются из OpenClaw автоматически (~30 сек), без ручной настройки
- **📊 Статусы агентов** — `WORKING` / `IDLE` / `RESTING` / `SMOKING` / `CHATTING`
- **📋 Панель задач** — история сессий и текущая активность каждого агента
- **🪙 Виджет токенов** — мониторинг расхода токенов по агентам и сессиям
- **🏗️ Зонирование офиса** — рабочие зоны, зоны отдыха, курилка, переговорки
- **🔐 JWT аутентификация** — защищённый доступ к офису

---

## 📋 Требования

| Зависимость | Версия | Примечание |
|-------------|--------|-----------|
| [Node.js](https://nodejs.org) | 22+ | LTS рекомендуется |
| [PostgreSQL](https://postgresql.org) | 16+ | Или через Docker |
| [OpenClaw](https://github.com/openclaw/openclaw) | latest | Должен быть установлен и иметь хотя бы одного агента |
| Git | any | — |

> **Важно:** OpenClaw Virtual Office читает агентов напрямую из директории `~/.openclaw/workspace-*/`. Убедитесь, что OpenClaw установлен и у вас есть хотя бы один настроенный агент.

---

## 🚀 Быстрый старт

### Вариант A: Нативный запуск

```bash
# 1. Клонировать репозиторий
git clone https://github.com/mogilevtsevdmitry/openclaw-virtual-office
cd openclaw-virtual-office

# 2. Настроить окружение
cp .env.example .env
# Отредактируйте .env: DATABASE_URL, JWT_SECRET, OPENCLAW_HOME

# 3. Установить зависимости
npm install

# 4. Применить миграции и собрать backend
cd apps/backend
npx prisma migrate deploy
npx nest build
cd ../..

# 5. Собрать frontend
cd apps/frontend
npm run build
cd ../..

# 6. Запустить
DATABASE_URL="postgresql://user:pass@localhost:5432/friday_db" \
JWT_SECRET="your-secret" \
node apps/backend/dist/apps/backend/src/main.js &

node proxy-server.js &
```

Офис доступен по адресу: **http://localhost:8080**

---

### Вариант B: Docker Compose

Требует предварительной сборки образов через GitHub Actions (или локально).

```bash
# 1. Клонировать репозиторий
git clone https://github.com/mogilevtsevdmitry/openclaw-virtual-office
cd openclaw-virtual-office

# 2. Настроить окружение
cp .env.example .env
# Отредактируйте .env: DB_PASSWORD, JWT_SECRET, OPENCLAW_HOME

# 3. Скачать образы и запустить
docker compose pull
docker compose up -d

# 4. Проверить статус
docker compose ps
docker compose logs -f backend
```

Офис доступен по адресу: **http://localhost:8080**

Для публичного доступа через интернет в compose уже включён **Cloudflare Tunnel** — URL появится в логах:
```bash
docker compose logs cloudflared | grep "https://"
```

---

## ⚙️ Конфигурация (.env)

Скопируйте `.env.example` в `.env` и заполните переменные:

| Переменная | Обязательная | Пример | Описание |
|------------|:----------:|--------|----------|
| `DATABASE_URL` | ✅ | `postgresql://friday:pass@localhost:5432/friday_db` | Строка подключения к PostgreSQL (для нативного запуска) |
| `DB_NAME` | — | `friday_db` | Имя БД (для Docker Compose) |
| `DB_USER` | — | `friday` | Пользователь БД (для Docker Compose) |
| `DB_PASSWORD` | ✅ | `s3cr3t` | Пароль БД |
| `DB_PORT` | — | `5432` | Порт PostgreSQL (по умолчанию: 5432) |
| `JWT_SECRET` | ✅ | `long-random-string` | Секрет для подписи JWT access-токенов |
| `JWT_REFRESH_SECRET` | ✅ | `another-long-string` | Секрет для подписи JWT refresh-токенов |
| `OPENCLAW_HOME` | ✅ | `/root/.openclaw` | Путь к директории OpenClaw с воркспейсами агентов |
| `PORT` | — | `3000` | Порт NestJS backend (по умолчанию: 3000) |
| `PROXY_PORT` | — | `8080` | Порт Node.js proxy / frontend (по умолчанию: 8080) |
| `NODE_ENV` | — | `production` | Окружение: `development` \| `production` |

> **Безопасность:** никогда не коммитьте `.env` с реальными секретами. Файл уже включён в `.gitignore`.

---

## 🏛️ Архитектура

```
┌─────────────────────────────────────────────────┐
│  OpenClaw Agents (filesystem)                   │
│  ~/.openclaw/workspace-<id>/IDENTITY.md         │
│  ~/.openclaw/workspace-<id>/session-*.json      │
└──────────────────┬──────────────────────────────┘
                   │ file scan (inotify/polling)
                   ▼
┌─────────────────────────────────────────────────┐
│  NestJS Backend  :3000                          │
│  ┌─────────────────────────────────────────┐   │
│  │  REST API  /api/v1/*                    │   │
│  │  WebSocket /realtime (Socket.IO)        │   │
│  │  Modules: agents, presence, office,     │   │
│  │           auth, communication, audit    │   │
│  └────────────────────┬────────────────────┘   │
│                        │ Prisma ORM             │
│  ┌─────────────────────▼────────────────────┐  │
│  │  PostgreSQL 16                           │  │
│  │  agents · floors · zones · presence      │  │
│  │  messages · events · outbox · inbox      │  │
│  └──────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ HTTP proxy + WS proxy
                   ▼
┌─────────────────────────────────────────────────┐
│  Node.js Proxy  :8080                           │
│  - Отдаёт статику React+Phaser (dist/)          │
│  - Проксирует /api/* → backend:3000             │
│  - Проксирует /realtime → backend:3000 (WS)     │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  nginx  :80/:443  (опционально)                 │
│  или Cloudflare Tunnel → публичный HTTPS URL    │
└─────────────────────────────────────────────────┘
```

### WebSocket события

Клиент подключается к `/realtime` и получает события в формате:

```typescript
interface WsEvent {
  eventId: string;        // UUID v4
  eventType: string;      // e.g. 'presence.state_changed'
  payload: object;        // данные события
  tenantId: string;
  occurredAt: string;     // ISO 8601
}
```

---

## 🤖 Агенты

OpenClaw Virtual Office автоматически обнаруживает агентов из файловой системы OpenClaw. Никакой ручной регистрации не требуется.

### Как это работает

1. OpenClaw создаёт воркспейс для каждого агента: `~/.openclaw/workspace-<agent-id>/`
2. В каждом воркспейсе есть файл `IDENTITY.md` с именем, ролью и эмодзи агента
3. Backend сканирует директорию `OPENCLAW_HOME` каждые ~30 секунд
4. Новый агент автоматически появляется в офисе

### Структура IDENTITY.md

```markdown
# IDENTITY.md

- **Name:** Федя
- **Role:** Senior DevOps / SRE Engineer
- **Emoji:** 🛠️
```

### Поддерживаемые роли

| Роль | Описание |
|------|----------|
| `DIRECTOR` | Директор / CEO |
| `FINANCIER` | Финансовый аналитик |
| `BACKEND` | Backend-разработчик |
| `DEVOPS` | DevOps / SRE инженер |
| `FRONTEND` | Frontend-разработчик |
| `ARCHITECT` | Архитектор |

### Статусы присутствия

```
IDLE ──→ WORKING ──→ RESTING
  ↑         │          │
  └─────────┴──→ SMOKING
               └──→ CHATTING
```

Переходы инициируются агентами через REST API или внутренними событиями системы.

---

## 🛠️ Разработка

### Предварительная настройка

```bash
git clone https://github.com/mogilevtsevdmitry/openclaw-virtual-office
cd openclaw-virtual-office

# Backend зависимости
cd apps/backend && npm install && cd ../..

# Frontend зависимости
cd apps/frontend && npm install && cd ../..

# Применить миграции Prisma
cd apps/backend
cp ../../.env.example .env  # настроить DATABASE_URL
npx prisma migrate dev --name init
```

### Запуск в режиме разработки

```bash
# Backend (watch mode + hot reload)
cd apps/backend
npm run start:dev
# → http://localhost:3000
# → WS: ws://localhost:3000/realtime

# Frontend (Vite dev server с HMR)
cd apps/frontend
npm run dev
# → http://localhost:5173
```

### Полезные команды

```bash
# Prisma Studio (GUI для БД)
cd apps/backend && npx prisma studio

# Создать новую миграцию
cd apps/backend && npx prisma migrate dev --name <migration_name>

# Сгенерировать Prisma Client
cd apps/backend && npx prisma generate

# Линтинг
npm run lint

# Тесты backend
cd apps/backend && npm run test
cd apps/backend && npm run test:e2e
```

### Структура монорепозитория

```
openclaw-virtual-office/
├── apps/
│   ├── backend/          # NestJS (DDD, CQRS, Hexagonal Architecture)
│   │   └── src/
│   │       └── modules/
│   │           ├── agents/       # BC: Agent Lifecycle
│   │           ├── office/       # BC: Office Layout
│   │           ├── presence/     # BC: Presence & Activity
│   │           ├── communication/# BC: Communication
│   │           ├── audit/        # BC: Audit & Replay
│   │           ├── auth/         # JWT Authentication
│   │           └── realtime/     # WebSocket Gateway
│   └── frontend/         # React + Vite + Phaser 3
│       └── src/
│           ├── scenes/   # Phaser scenes (OfficeScene и др.)
│           ├── stores/   # Zustand stores
│           └── api/      # Axios API клиент
├── infra/
│   └── postgres/
│       └── init.sql      # Инициализация БД
├── proxy-server.js        # Node.js proxy (статика + API)
├── docker-compose.yml
└── .env.example
```

---

## 📦 Стек технологий

### Backend
| Технология | Версия | Назначение |
|------------|--------|-----------|
| [NestJS](https://nestjs.com) | 10 | Web-фреймворк (DDD/CQRS/Hexagonal) |
| [Prisma](https://prisma.io) | 5 | ORM + миграции |
| [PostgreSQL](https://postgresql.org) | 16 | Основная БД |
| [Socket.IO](https://socket.io) | 4 | WebSocket real-time |
| JWT | — | Аутентификация (access 15m + refresh 7d) |
| TypeScript | strict | Язык разработки |

### Frontend
| Технология | Версия | Назначение |
|------------|--------|-----------|
| [React](https://react.dev) | 18 | UI-фреймворк |
| [Phaser](https://phaser.io) | 3 | 2D canvas рендер офиса |
| [Vite](https://vitejs.dev) | 5 | Сборщик и dev-сервер |
| [Zustand](https://zustand-demo.pmnd.rs) | — | Глобальное состояние |
| [Axios](https://axios-http.com) | — | HTTP-клиент |

### Инфраструктура
| Технология | Назначение |
|------------|-----------|
| Docker + Compose | Контейнеризация |
| GitHub Actions | CI/CD, сборка образов → GHCR |
| nginx | Reverse proxy (prod) |
| [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) | Публичный HTTPS без открытых портов |

---

## 🤝 Contributing

Будем рады вашему вкладу! Если вы нашли баг или хотите предложить улучшение:

1. **Баги** — откройте [Issue](https://github.com/mogilevtsevdmitry/openclaw-virtual-office/issues) с описанием проблемы и шагами воспроизведения
2. **Фичи** — обсудите идею в Issues перед созданием PR
3. **Pull Requests:**
   ```bash
   git checkout -b feat/your-feature
   # ... коммиты ...
   git push origin feat/your-feature
   # Открыть PR в main
   ```
4. Убедитесь, что `npm run lint` и тесты проходят перед отправкой PR

---

## 📄 License

MIT © [mogilevtsevdmitry](https://github.com/mogilevtsevdmitry)

---

<div align="center">
  <sub>Сделано с ❤️ командой OpenClaw AI Agents</sub>
</div>
