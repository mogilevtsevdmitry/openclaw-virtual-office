# TASK_DEVOPS.md — Задачи Феди (Этап 4: Интеграция и запуск)
> Выполняется ПОСЛЕ того, как Ваня и Макс закончат Этапы 2-3

---

## ЭТАП 4: Интеграция и Production-ready запуск

### D1. Prisma Schema — добавить таблицу `users`
**Что сделать:**
- Добавить в `prisma/schema.prisma`:
  ```prisma
  model User {
    id           String   @id @default(uuid())
    email        String   @unique
    passwordHash String
    tenantId     String
    role         String   @default("USER")
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
  }
  ```
- Запустить: `npx prisma migrate dev --name add_users`
- Проверить что все 12 таблиц работают

**Зависимости:** B1 Вани должен передать схему

---

### D2. Environment конфигурация
**Что сделать:**
- Создать `.env.example` с ВСЕМИ переменными:
  ```
  DATABASE_URL=postgresql://friday:friday_password@localhost:5432/friday_db
  JWT_SECRET=<generate 256-bit secret>
  JWT_REFRESH_SECRET=<generate 256-bit secret>
  JWT_EXPIRES_IN=15m
  JWT_REFRESH_EXPIRES_IN=7d
  PORT=3000
  FRONTEND_URL=http://localhost:5173
  NODE_ENV=development
  ```
- `.env` — НЕ коммитить (в .gitignore)
- Проверить что `ConfigModule` читает все переменные

---

### D3. CORS настройка
**Что сделать:**
- В `apps/backend/src/main.ts`:
  ```typescript
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,  // для httpOnly cookie refresh token
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  ```
- Проверить что frontend на 5173 может делать запросы к 3000

---

### D4. Скрипты запуска (монорепо)
**Что сделать:**
- Обновить `package.json` корневого монорепо:
  ```json
  {
    "scripts": {
      "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
      "dev:backend": "npm run start:dev --workspace=apps/backend",
      "dev:frontend": "npm run dev --workspace=apps/frontend",
      "migrate": "npm run prisma:migrate --workspace=apps/backend",
      "db:studio": "npx prisma studio --schema=apps/backend/prisma/schema.prisma"
    }
  }
  ```
- Установить: `npm install -D concurrently`

---

### D5. Health checks полный
**Что сделать:**
- Расширить `GET /health`:
  ```json
  {
    "status": "ok",
    "db": "connected",
    "ws": "active",
    "uptime": 12345,
    "version": "0.1.0"
  }
  ```
- Добавить Prisma connectivity check в HealthModule
- Добавить WS connections count

---

### D6. Docker Compose (для локального dev)
**Что сделать:**
- `docker-compose.yml` в корне (только БД, не приложение):
  ```yaml
  version: '3.8'
  services:
    postgres:
      image: postgres:15-alpine
      environment:
        POSTGRES_DB: friday_db
        POSTGRES_USER: friday
        POSTGRES_PASSWORD: friday_password
      ports:
        - "5432:5432"
      volumes:
        - pgdata:/var/lib/postgresql/data
  volumes:
    pgdata:
  ```
- Команда запуска: `docker compose up -d postgres`

---

### D7. Smoke тесты интеграции
**Что сделать:**
- Bash скрипт `scripts/smoke-test.sh`:
  ```bash
  #!/bin/bash
  # Проверяет что весь стек работает
  curl -f http://localhost:3000/health && echo "✓ Backend OK"
  curl -f http://localhost:5173 && echo "✓ Frontend OK"
  # Auth flow
  TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test123"}' | jq -r .accessToken)
  [ -n "$TOKEN" ] && echo "✓ Auth OK" || echo "✗ Auth FAIL"
  ```

---

### D8. Nginx конфиг (для prod — не для MVP)
**Что сделать (подготовить, не применять):**
- Создать `infra/nginx/nginx.conf`:
  - `/api/*` → proxy_pass `http://localhost:3000`
  - `/socket.io/*` → proxy_pass с WebSocket upgrade
  - `/` → static из `apps/frontend/dist`
- Пока не применять — только файл в репо

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

```
D1 (migrate) → D2 (env) → D3 (cors) → D4 (scripts) → D5 (health) → D6 (docker) → D7 (smoke) → D8 (nginx)
```

> D1-D4 можно делать параллельно с Ваней (Backend Этап 2)  
> D7 — только после завершения Этапа 2 и 3
