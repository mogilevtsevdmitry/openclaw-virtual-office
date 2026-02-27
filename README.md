# OpenClaw Virtual Office

Монорепозиторий виртуального офиса на NestJS (DDD/CQRS/Hexagonal) + React+Vite.

## Структура

```
openclaw-virtual-office/
├── apps/
│   ├── backend/          # NestJS backend (DDD, CQRS, Prisma)
│   ├── frontend/         # React + Vite frontend
│   ├── office-layout/    # BC: Office Layout (skeleton)
│   ├── agent-lifecycle/  # BC: Agent Lifecycle (skeleton)
│   ├── presence/         # BC: Presence & Activity (skeleton)
│   ├── communication/    # BC: Communication (skeleton)
│   ├── audit/            # BC: Audit & Replay (skeleton)
│   └── realtime-gateway/ # Cross-cutting: WebSocket hub (skeleton)
└── libs/
    ├── shared-kernel/    # Shared base classes (skeleton)
    └── api-contracts/    # Integration event schemas (skeleton)
```

## Запуск

```bash
# Backend
cd apps/backend
npm run start:dev   # Development с hot reload
node dist/main.js   # Production

# Frontend
cd apps/frontend
npm run dev         # Development
npm run build       # Production build

# Prisma
cd apps/backend
npx prisma migrate dev --name <migration_name>
npx prisma studio
```

## Переменные окружения (apps/backend/.env)

```
DATABASE_URL=postgresql://friday:CHANGE_ME_DB_PASSWORD@localhost:5432/friday_db?schema=public
PORT=3000
NODE_ENV=development
JWT_SECRET=CHANGE_ME_JWT_SECRET
LOG_FORMAT=json
LOG_LEVEL=debug
```

## Endpoints

- `GET /health` — healthcheck
- `WS /realtime` — WebSocket Gateway

## PostgreSQL

- Host: localhost:5432
- DB: friday_db
- User: friday
- Schema: public
- Таблицы: agents, floors, zones, office_objects, presence, messages, chat_rooms, events, outbox, inbox
