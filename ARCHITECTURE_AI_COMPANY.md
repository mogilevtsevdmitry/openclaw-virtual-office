# OpenClaw AI Company — Architecture Design

**Версия:** 1.0  
**Статус:** Design / RFC  
**Автор:** Пятница  
**База:** PostgreSQL 16, существующий friday_db, outbox+inbox+events pattern

---

## 0. Инварианты системы

```
1. Автономность    — pipeline не требует человека по умолчанию
2. Безопасность    — любое prod-действие проходит gateway + policy check
3. Воспроизводимость — состояние восстанавливается из event stream
4. Audit           — каждое действие имеет command_id + actor + reason
5. Изоляция        — tenant_id на каждой строке каждой таблицы
```

**Definition of Done "Production Ready":**
- Код задеплоен + healthcheck зелёный
- CI artifacts сохранены
- Deployment record создан в audit log
- Post-deploy metrics baseline зафиксирован
- Rollback strategy задокументирована

---

## 1. Bounded Contexts (DDD)

```
┌─────────────────────────────────────────────────────────────┐
│                     PLATFORM LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Workflow  │  │  Policy  │  │  Audit   │  │  Memory    │  │
│  │  Engine  │  │  Engine  │  │   Log    │  │ (Archivist)│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                         ↑ event bus (pg_notify + outbox)     │
├─────────────────────────────────────────────────────────────┤
│                     EXECUTION LAYER                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Tool Gateway                        │   │
│  │  git | ci | registry | deploy | db | cloud           │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     AGENT LAYER                              │
│  BA │ Product │ Arch │ Backend │ Frontend │ QA │ Sec │ DevOps│
└─────────────────────────────────────────────────────────────┘
```

### Bounded Contexts:

| BC | Агрегат | Owner | Граница |
|---|---|---|---|
| **Project** | Project, PipelineRun | Tech Lead | Жизненный цикл продукта |
| **Workflow** | Stage, Task, Gate | Orchestrator | State machine |
| **Artifact** | Artifact, ArtifactVersion | Archivist | Immutable records |
| **Policy** | PolicyRule, Approval, RiskScore | Security | Enforcement |
| **Execution** | Command, ExecutionResult | Tool Gateway | Real-world actions |
| **Audit** | AuditEntry, EventLog | Archivist | Immutable history |
| **Tenant** | Tenant, Quota, Environment | Platform | Isolation |

---

## 2. Database Schema

### 2.1 Tenant & Environment

```sql
-- Мультитенантность и окружения
CREATE TABLE tenants (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'standard', -- standard | enterprise
  mode        TEXT NOT NULL DEFAULT 'autonomous', -- autonomous | semi-autonomous
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE environments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL, -- prod | staging | dev
  type        TEXT NOT NULL, -- PRODUCTION | STAGING | DEVELOPMENT
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE quotas (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) UNIQUE,
  max_projects    INT NOT NULL DEFAULT 10,
  max_parallel    INT NOT NULL DEFAULT 3,   -- параллельных pipeline
  max_deploys_day INT NOT NULL DEFAULT 20,
  token_budget    BIGINT,                    -- NULL = unlimited
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.2 Project & Pipeline

```sql
CREATE TYPE project_type AS ENUM (
  'WEB_APP',        -- web-app SaaS pipeline
  'TELEGRAM_BOT',   -- telegram-bot pipeline
  'MICRO_SERVICE',  -- microservice pipeline
  'LANDING',        -- landing page pipeline (lite)
  'CUSTOM'
);

CREATE TYPE pipeline_status AS ENUM (
  'PENDING',
  'RUNNING',
  'PAUSED',         -- ожидает human approval
  'BLOCKED',        -- deadlock / gate failed
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE projects (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  type            project_type NOT NULL,
  description     TEXT,
  repo_url        TEXT,
  environment_id  TEXT REFERENCES environments(id),
  status          pipeline_status NOT NULL DEFAULT 'PENDING',
  meta            JSONB NOT NULL DEFAULT '{}',  -- произвольные теги, ссылки
  created_by      TEXT NOT NULL,                -- agent_id или user_id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  INDEX(tenant_id),
  INDEX(status),
  INDEX(type)
);

CREATE TABLE pipeline_runs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL REFERENCES projects(id),
  tenant_id       TEXT NOT NULL,
  template        project_type NOT NULL,   -- снапшот шаблона на момент запуска
  status          pipeline_status NOT NULL DEFAULT 'PENDING',
  current_stage   TEXT,                    -- IDEA | DISCOVERY | ARCHITECTURE | ...
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  triggered_by    TEXT NOT NULL,           -- agent_id или user_id
  correlation_id  TEXT NOT NULL DEFAULT gen_random_uuid(),

  INDEX(project_id),
  INDEX(tenant_id),
  INDEX(status),
  INDEX(correlation_id)
);
```

### 2.3 Stage Machine

```sql
CREATE TYPE stage_status AS ENUM (
  'PENDING',
  'ACTIVE',
  'IN_REVIEW',    -- gate check
  'APPROVED',
  'REJECTED',
  'SKIPPED',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE pipeline_stages (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          TEXT NOT NULL REFERENCES pipeline_runs(id),
  tenant_id       TEXT NOT NULL,
  stage_name      TEXT NOT NULL,   -- IDEA | DISCOVERY | ARCHITECTURE | ...
  stage_order     INT NOT NULL,
  status          stage_status NOT NULL DEFAULT 'PENDING',
  owner_agent     TEXT NOT NULL,   -- agent_id ответственного
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  gate_result     JSONB,           -- результат gate review
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,  -- max iterations per stage

  UNIQUE(run_id, stage_name),
  INDEX(run_id),
  INDEX(tenant_id),
  INDEX(status)
);

-- Зависимости между стадиями (DAG)
CREATE TABLE stage_dependencies (
  stage_id        TEXT NOT NULL REFERENCES pipeline_stages(id),
  depends_on_id   TEXT NOT NULL REFERENCES pipeline_stages(id),
  PRIMARY KEY(stage_id, depends_on_id)
);
```

### 2.4 Artifacts (Source of Truth)

```sql
CREATE TYPE artifact_type AS ENUM (
  'PRD',           -- Product Requirements Document
  'ADR',           -- Architecture Decision Record
  'C4_DIAGRAM',    -- C4 architecture diagram
  'DATA_MODEL',    -- Database schema / ERD
  'THREAT_MODEL',  -- Security threat model
  'TEST_REPORT',   -- QA test results
  'DEPLOY_RECORD', -- Deployment manifest + result
  'RUNBOOK',       -- Operations runbook
  'CHANGE_REQUEST',-- Запрос на изменение требований
  'POSTMORTEM'     -- Incident postmortem
);

CREATE TABLE artifacts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  run_id          TEXT REFERENCES pipeline_runs(id),
  stage_name      TEXT,                    -- на какой стадии создан
  type            artifact_type NOT NULL,
  title           TEXT NOT NULL,
  version         INT NOT NULL DEFAULT 1,
  content_hash    TEXT NOT NULL,           -- SHA-256 контента
  content         JSONB NOT NULL,          -- сам документ (структурированный)
  content_path    TEXT,                    -- путь к файлу если есть
  owner_agent     TEXT NOT NULL,           -- кто создал
  is_superseded   BOOLEAN NOT NULL DEFAULT FALSE,  -- есть более новая версия
  superseded_by   TEXT REFERENCES artifacts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  INDEX(tenant_id),
  INDEX(project_id),
  INDEX(type),
  INDEX(stage_name),
  INDEX(content_hash)
);

-- Change Request — дрейф требований под контролем
CREATE TABLE change_requests (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  project_id      TEXT NOT NULL REFERENCES projects(id),
  artifact_id     TEXT NOT NULL REFERENCES artifacts(id),  -- что меняется
  requested_by    TEXT NOT NULL,
  description     TEXT NOT NULL,
  impact          TEXT NOT NULL,   -- LOW | MEDIUM | HIGH
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  INDEX(project_id),
  INDEX(status)
);
```

### 2.5 Policy & Approvals

```sql
CREATE TABLE policy_rules (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  action          TEXT NOT NULL,   -- deploy.prod | git.merge_main | db.migrate | ...
  environment     TEXT,            -- NULL = all envs
  conditions      JSONB NOT NULL,  -- { require: [...], deny_if: [...] }
  risk_level      TEXT NOT NULL,   -- LOW | MEDIUM | HIGH | CRITICAL
  require_human   BOOLEAN NOT NULL DEFAULT FALSE,
  require_agents  TEXT[],          -- agent roles чьё одобрение нужно
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, name)
);

CREATE TABLE approvals (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  run_id          TEXT NOT NULL REFERENCES pipeline_runs(id),
  stage_name      TEXT NOT NULL,
  action          TEXT NOT NULL,   -- что требует одобрения
  policy_rule_id  TEXT REFERENCES policy_rules(id),
  requested_by    TEXT NOT NULL,
  approved_by     TEXT,
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED | EXPIRED
  reason          TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at      TIMESTAMPTZ,

  INDEX(run_id),
  INDEX(tenant_id),
  INDEX(status)
);
```

### 2.6 Tool Gateway — Command Log

```sql
CREATE TYPE command_status AS ENUM (
  'PENDING',
  'DRY_RUN',       -- dry-run выполнен, ожидает подтверждения
  'EXECUTING',
  'SUCCEEDED',
  'FAILED',
  'ROLLED_BACK'
);

CREATE TABLE gateway_commands (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  idempotency_key     TEXT NOT NULL,   -- предотвращает двойное выполнение
  action              TEXT NOT NULL,   -- git.push | deploy.prod | db.migrate | ...
  tool                TEXT NOT NULL,   -- git | ci | docker | kubectl | psql
  params              JSONB NOT NULL,
  environment         TEXT,
  is_dry_run          BOOLEAN NOT NULL DEFAULT FALSE,
  dry_run_result      JSONB,
  status              command_status NOT NULL DEFAULT 'PENDING',
  executed_by         TEXT NOT NULL,   -- agent_id
  approval_id         TEXT REFERENCES approvals(id),
  run_id              TEXT REFERENCES pipeline_runs(id),
  result              JSONB,
  error               TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  rollback_command_id TEXT REFERENCES gateway_commands(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(idempotency_key),
  INDEX(tenant_id),
  INDEX(action),
  INDEX(status),
  INDEX(run_id)
);
```

### 2.7 Pipeline Templates

```sql
CREATE TABLE pipeline_templates (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT,  -- NULL = системный шаблон
  type        project_type NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  stages      JSONB NOT NULL,  -- массив stage definitions
  gates       JSONB NOT NULL,  -- условия перехода между стадиями
  policies    JSONB NOT NULL,  -- policy rules для этого типа
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Pipeline Templates

### Template: WEB_APP

```jsonc
{
  "type": "WEB_APP",
  "stages": [
    {
      "name": "IDEA",
      "order": 1,
      "owner": "ba",
      "consults": ["product"],
      "max_iterations": 3,
      "outputs": ["PRD"],
      "gate": {
        "require_artifacts": ["PRD"],
        "require_approval": ["product"]
      }
    },
    {
      "name": "DISCOVERY",
      "order": 2,
      "owner": "product",
      "consults": ["ba", "techlead"],
      "max_iterations": 3,
      "outputs": ["PRD"],  // обновляет PRD
      "gate": {
        "require_artifacts": ["PRD"],
        "checks": ["mvp_defined", "metrics_defined"]
      }
    },
    {
      "name": "ARCHITECTURE",
      "order": 3,
      "owner": "solution",
      "consults": ["security", "sql", "ddd"],
      "max_iterations": 3,
      "outputs": ["ADR", "C4_DIAGRAM", "DATA_MODEL", "THREAT_MODEL"],
      "gate": {
        "require_artifacts": ["ADR", "C4_DIAGRAM", "DATA_MODEL", "THREAT_MODEL"],
        "require_approval": ["techlead", "security"]
      }
    },
    {
      "name": "PLANNING",
      "order": 4,
      "owner": "techlead",
      "outputs": ["TASK_BREAKDOWN"],
      "gate": {
        "checks": ["tasks_assigned", "dependencies_mapped"]
      }
    },
    {
      "name": "BUILD",
      "order": 5,
      "owner": "backend",
      "parallel_owners": ["frontend", "sql"],
      "constraints": [
        "feature_branch_only",
        "schema_via_sql_only",
        "no_direct_merge"
      ],
      "gate": {
        "checks": ["ci_green", "pr_opened"],
        "require_approval": ["techlead"]  // merge main
      }
    },
    {
      "name": "QA",
      "order": 6,
      "owner": "qa",
      "max_fix_cycles": 3,
      "outputs": ["TEST_REPORT"],
      "gate": {
        "require_artifacts": ["TEST_REPORT"],
        "checks": ["ac_satisfied", "no_critical_bugs"]
      }
    },
    {
      "name": "SECURITY_GATE",
      "order": 7,
      "owner": "security",
      "outputs": ["THREAT_MODEL"],  // обновляет
      "gate": {
        "checks": [
          "no_critical_vulnerabilities",
          "dependency_scan_passed",
          "ci_integrity_verified"
        ],
        "can_block": true  // security может остановить pipeline
      }
    },
    {
      "name": "DEPLOY",
      "order": 8,
      "owner": "devops",
      "outputs": ["DEPLOY_RECORD"],
      "gate": {
        "require_artifacts": ["DEPLOY_RECORD"],
        "checks": ["healthcheck_passed", "no_rollback_triggered"],
        "policies": ["deploy.prod"],
        "rollback_required": true
      }
    },
    {
      "name": "PRODUCTION",
      "order": 9,
      "owner": "devops",
      "outputs": ["RUNBOOK"],
      "gate": {
        "checks": [
          "metrics_baseline_set",
          "runbook_created",
          "alerts_configured"
        ]
      }
    }
  ]
}
```

### Template: TELEGRAM_BOT

```jsonc
{
  "type": "TELEGRAM_BOT",
  "stages": [
    { "name": "IDEA",         "order": 1, "owner": "ba"      },
    { "name": "ARCHITECTURE", "order": 2, "owner": "solution",
      "outputs": ["ADR", "DATA_MODEL"] },           // без C4 + Threat Model
    { "name": "BUILD",        "order": 3, "owner": "backend" },
    { "name": "QA",           "order": 4, "owner": "qa"      },
    { "name": "DEPLOY",       "order": 5, "owner": "devops"  }
  ]
}
// Нет SECURITY_GATE (добавляется при боте с платёжными данными)
// Нет PLANNING (для простых ботов)
// Нет PRODUCTION stage (lite)
```

---

## 4. Events — Domain Event Taxonomy

Используем существующую таблицу `events` + `outbox`.

### Naming convention: `<BC>.<Aggregate>.<Past Tense>`

```
project.Project.Created
project.Project.StatusChanged
project.PipelineRun.Started
project.PipelineRun.StageTransitioned
project.PipelineRun.Completed
project.PipelineRun.Failed
project.PipelineRun.Paused        // ожидает human approval

artifact.Artifact.Created
artifact.Artifact.Superseded
artifact.ChangeRequest.Raised
artifact.ChangeRequest.Approved
artifact.ChangeRequest.Rejected

policy.Approval.Requested
policy.Approval.Granted
policy.Approval.Denied
policy.Approval.Expired
policy.PolicyViolation.Detected

execution.Command.Issued
execution.Command.DryRunCompleted
execution.Command.Executed
execution.Command.Failed
execution.Command.RolledBack

workflow.Deadlock.Detected
workflow.Escalation.Triggered     // → Пятница
workflow.Escalation.ToHuman       // → CTO/Дмитрий
```

### Event payload contract (строгий):

```typescript
interface DomainEvent {
  event_id:       string;   // UUID, уникален навсегда
  event_type:     string;   // taxonomy выше
  source_bc:      string;   // bounded context
  aggregate_id:   string;   // project_id / run_id / artifact_id
  tenant_id:      string;
  correlation_id: string;   // общий для всего pipeline run
  causation_id:   string;   // event_id который вызвал этот event
  command_id:     string;   // если вызван командой
  version:        number;   // версия схемы payload
  occurred_at:    string;
  payload:        Record<string, unknown>;
}
```

---

## 5. Tool Gateway

### Архитектура

```
Agent → [Policy Check] → [Idempotency Check] → [Dry Run?] → [Execute] → [Audit Log]
                ↓                                                              ↓
          BLOCK if violation                                           gateway_commands
```

### Wrapper scripts (Phase 1 — pragmatic)

```
/root/scripts/tool-gateway/
├── gateway.sh              # главный entrypoint: gateway <action> <params>
├── policy-check.sh         # читает policy_rules из DB
├── git-push.sh             # git.push_feature — проверяет: branch != main
├── git-merge.sh            # git.merge_main — требует: ci.green + approvals
├── ci-run.sh               # ci.trigger — запускает GitHub Actions
├── ci-status.sh            # ci.status — читает результат
├── docker-build.sh         # docker.build — строит образ
├── docker-push.sh          # docker.push — пушит в registry
├── deploy-prod.sh          # deploy.prod — САМЫЙ ЗАЩИЩЁННЫЙ
│                             # требует: qa.approved + security.approved + ci.green
│                             # записывает в gateway_commands с idempotency_key
│                             # всегда создаёт rollback_command_id заранее
├── deploy-rollback.sh      # deploy.rollback — выполняет заранее подготовленный rollback
└── db-migrate.sh           # db.migrate — backup FIRST, then migrate
                              # требует: director.approval для destructive
```

### `gateway.sh` — главная точка входа

```bash
#!/bin/bash
# Usage: gateway.sh <action> <idempotency_key> <agent_id> <run_id> [params...]
#
# Шаги:
# 1. Проверить idempotency_key в gateway_commands — если SUCCEEDED, вернуть cached result
# 2. Записать команду со статусом PENDING
# 3. Запустить policy-check.sh для action
# 4. Если policy.require_approval: создать approval record, вернуть PENDING
# 5. Если --dry-run: выполнить dry-run, обновить статус DRY_RUN
# 6. Выполнить action-specific script
# 7. Обновить статус SUCCEEDED / FAILED
# 8. INSERT в outbox (action executed event)
# 9. pg_notify 'pipeline_events' <run_id>
```

### Policy check — пример для deploy.prod

```yaml
# /root/scripts/policies/deploy-prod.yaml
action: deploy.prod
environment: production
risk_level: HIGH
require_human: false          # autonomous mode
# require_human: true         # semi-autonomous mode (enterprise)
require_agent_approvals:
  - role: qa
    check: stage.QA.status == COMPLETED
  - role: security
    check: stage.SECURITY_GATE.status == COMPLETED
require_checks:
  - ci.status == green
  - healthcheck.pre_deploy == passing
rollback_strategy: required   # rollback команда должна быть задана заранее
deny_if:
  - change_requests.open > 0  # нельзя деплоить при открытых CR
  - approvals.expired > 0
```

---

## 6. Orchestrator — Tech Lead Agent Protocol

Tech Lead читает pipeline state из DB и управляет через events.

### Bootstrap нового проекта:

```
1. Дмитрий → Пятница: "Сделай telegram-бота для X"
2. Пятница:
   INSERT INTO projects (name, type='TELEGRAM_BOT', created_by='main')
   INSERT INTO pipeline_runs (project_id, triggered_by='main', correlation_id)
   INSERT INTO pipeline_stages [...из template...]
   INSERT INTO outbox (event_type='project.Project.Created', ...)
   → sessions_spawn(agentId='techlead', task='<structured brief>')
3. Tech Lead получает brief с project_id + run_id
4. Tech Lead читает pipeline_stages для run_id
5. Tech Lead активирует stage[0]: UPDATE pipeline_stages SET status='ACTIVE'
6. Tech Lead → sessions_spawn(agentId='ba', task='<IDEA stage brief>')
7. BA создаёт PRD → INSERT INTO artifacts
8. BA → INSERT INTO outbox (event_type='artifact.Artifact.Created', ...)
9. Tech Lead получает уведомление (poll outbox или pg_notify)
10. Tech Lead проверяет gate conditions
11. Gate passed → UPDATE stage status='COMPLETED', следующая stage='ACTIVE'
```

### Deadlock handler:

```
if stage.attempts >= stage.max_attempts:
  INSERT INTO outbox (event_type='workflow.Deadlock.Detected')
  → sessions_send(sessionKey='main', message='<deadlock summary>')
  UPDATE pipeline_stages SET status='BLOCKED'
  UPDATE pipeline_runs SET status='PAUSED'
```

---

## 7. Inter-Agent Communication Protocol

### Строгий формат (обязателен для всех агентов):

```
[FROM: <role>] [TO: <role>] [RUN: <run_id>] [STAGE: <stage>] [CORR: <correlation_id>]
TYPE: REQUEST | RESPONSE | NOTIFICATION | ESCALATION

Context:    <краткий контекст>
Objective:  <что нужно>
Input:      <артефакты / данные>
Constraints:<ограничения>
===
Analysis:   <анализ>
Options:    <варианты если есть>
Risks:      <риски>
Decision:   <ОБЯЗАТЕЛЬНО если это RESPONSE>
Artifacts:  <artifact_ids если созданы>
```

### Iteration counter (enforcement в промпте):
```
Iteration: 1/3  ← Tech Lead устанавливает, агенты не могут сбросить
```

---

## 8. Scalability Model

### Multi-tenant isolation:

```sql
-- Row-level security на всех таблицах pipeline BC
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id'));
-- То же для: pipeline_runs, pipeline_stages, artifacts, approvals, gateway_commands
```

### Parallel projects — очередь и лимиты:

```sql
-- Проверка квоты перед запуском нового pipeline
CREATE OR REPLACE FUNCTION check_pipeline_quota(p_tenant_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT COUNT(*) < (SELECT max_parallel FROM quotas WHERE tenant_id = p_tenant_id)
  FROM pipeline_runs
  WHERE tenant_id = p_tenant_id AND status IN ('RUNNING', 'PAUSED');
$$ LANGUAGE SQL;
```

### Semi-autonomous mode (enterprise):

```sql
-- Флаг на уровне tenant
UPDATE tenants SET mode = 'semi-autonomous' WHERE id = '<enterprise_tenant>';

-- Policy engine проверяет mode:
-- autonomous:       require_human = FALSE (все approvals — агенты)
-- semi-autonomous:  require_human = TRUE  для HIGH + CRITICAL risk actions
```

### Добавление staging окружения — без переработки модели:

```sql
INSERT INTO environments (tenant_id, name, type, config)
VALUES ('<id>', 'staging', 'STAGING', '{"k8s_namespace": "staging", "db_url": "..."}');
-- gateway_commands.environment хранит 'staging' | 'prod'
-- policy_rules.environment = 'staging' — отдельные правила
```

---

## 9. Observability

### Метрики из DB (запросы):

```sql
-- Среднее время на каждой стадии
SELECT stage_name,
       AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60) AS avg_minutes,
       COUNT(*) FILTER (WHERE status = 'FAILED') AS failures
FROM pipeline_stages
GROUP BY stage_name;

-- Deploy success rate (30 дней)
SELECT
  COUNT(*) FILTER (WHERE status = 'SUCCEEDED') * 100.0 / COUNT(*) AS success_rate,
  COUNT(*) FILTER (WHERE status = 'ROLLED_BACK') AS rollbacks
FROM gateway_commands
WHERE action = 'deploy.prod'
  AND created_at > now() - INTERVAL '30 days';

-- Deadlock frequency
SELECT COUNT(*) FROM events
WHERE event_type = 'workflow.Deadlock.Detected'
  AND occurred_at > now() - INTERVAL '7 days';
```

### pg_notify для real-time:

```sql
-- Trigger на pipeline_stages — уведомляет оркестратор при изменении статуса
CREATE OR REPLACE FUNCTION notify_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'pipeline_events',
    json_build_object(
      'run_id', NEW.run_id,
      'stage', NEW.stage_name,
      'status', NEW.status,
      'tenant_id', NEW.tenant_id
    )::TEXT
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stage_change_notify
  AFTER UPDATE OF status ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION notify_stage_change();
```

---

## 10. Фазы реализации

### Фаза 0 — Foundation (1 неделя)
- [ ] SQL миграции: tenants, environments, projects, pipeline_runs, pipeline_stages
- [ ] SQL миграции: artifacts, approvals, gateway_commands, policy_rules
- [ ] Pipeline templates (WEB_APP + TELEGRAM_BOT) как JSONB в DB
- [ ] pg_notify trigger на pipeline_stages
- [ ] Seed: tenant 'openclaw', environment 'prod', базовые policy_rules

### Фаза 1 — Bootstrap Loop (1 неделя)
- [ ] `POST /api/v1/projects` → создаёт project + run + stages + notifies Tech Lead
- [ ] Tech Lead SOUL.md обновлён: читает pipeline state из DB, управляет стадиями
- [ ] Archivist SOUL.md обновлён: подписан на outbox, создаёт artifacts
- [ ] Minimal working loop: IDEA → PRD artifact → DISCOVERY

### Фаза 2 — Tool Gateway (1 неделя)
- [ ] `/root/scripts/tool-gateway/gateway.sh` — idempotency + audit
- [ ] Wrapper scripts для: git-push, git-merge, ci-run, deploy-prod, db-migrate
- [ ] policy-check.sh читает policy_rules из DB
- [ ] Тест: попытка deploy без qa.approved → BLOCK

### Фаза 3 — Full Pipeline (2 недели)
- [ ] Все 9 стадий для WEB_APP работают end-to-end
- [ ] Deadlock detection + escalation
- [ ] Change Request flow
- [ ] Rollback flow

### Фаза 4 — Scale (по необходимости)
- [ ] Multi-tenant RLS
- [ ] Quota enforcement
- [ ] Staging environment
- [ ] Semi-autonomous mode
- [ ] Parallel projects

---

## 11. Риски и митигации

| Риск | Вероятность | Митигация |
|---|---|---|
| Агент игнорирует policy (промпт забыт) | СРЕДНЯЯ | Gateway enforcement вне агента — агент физически не может обойти |
| Compaction теряет pipeline state | ВЫСОКАЯ | Весь state в DB — агент может восстановить из `SELECT` при старте |
| Дрейф требований без контроля | СРЕДНЯЯ | ChangeRequest table — нельзя изменить PRD без CR |
| Deadlock без выхода | НИЗКАЯ | Max 3 iterations → escalate → human |
| Двойной деплой | НИЗКАЯ | Idempotency key в gateway_commands |
| Дорогие токены на большой pipeline | ВЫСОКАЯ | Бюджет в quotas.token_budget + краткие structured prompts |

---

*Следующий шаг: Фаза 0 — SQL миграции. Выполняет: Ваня (backend) по этому документу.*
