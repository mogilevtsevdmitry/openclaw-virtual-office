# Git Workflow — AI Agent Code Delivery

Описание процесса доставки кода от агентов через review Tech Lead в репозиторий.

## Участники

| Агент | Роль | Действие |
|-------|------|----------|
| backend / frontend / qa / etc | Разработчик | Пишет код, делает коммиты |
| techlead | Reviewer | Просматривает diff, approve/reject |
| devops (Федя) | Deployer | Merge + push через Tool Gateway |

## Схема

```
Агент пишет код
      ↓
agent-commit.sh → feature/<run_id_8>-<agent_id>
      ↓
sessions_send(techlead): "ветка готова"
      ↓
Tech Lead: agent-review.sh <run_id> <branch>
      ↓
   approve?
   ├── NO → agent-review.sh reject → агент дорабатывает
   └── YES → agent-review.sh approve → записывает CODE_REVIEW approval в DB
                    ↓
   sessions_send(devops): "можно merge + push"
                    ↓
   Федя: gateway.sh git.merge_local  (policy check: CODE_REVIEW APPROVED)
                    ↓
   Федя: gateway.sh git.push_main    (policy check: CODE_REVIEW APPROVED)
                    ↓
   GitHub Actions CI → build + test
```

## Скрипты

### agent-commit.sh (агент-разработчик)
```bash
cat << 'EOF' | bash /root/scripts/agent-tools/agent-commit.sh <agent_id> <run_id> <file_path> "<commit msg>"
<содержимое файла>
EOF
```
- Создаёт ветку `feature/<run_id_8>-<agent_id>` если не существует
- Записывает файл, `git add`, `git commit`
- **Не пушит** — только локальный коммит

### agent-review.sh (Tech Lead)
```bash
# Только просмотр
bash /root/scripts/agent-tools/agent-review.sh <run_id> <branch>

# Одобрить
bash /root/scripts/agent-tools/agent-review.sh <run_id> <branch> approve "LGTM — комментарий"

# Отклонить
bash /root/scripts/agent-tools/agent-review.sh <run_id> <branch> reject "Нужно: описание"
```
- При approve → пишет запись в `approvals` (stage_name=CODE_REVIEW, action=git.merge_main)
- Без этой записи gateway.sh git.merge_local и git.push_main заблокированы

### gateway.sh git.merge_local (Федя)
```bash
/root/scripts/tool-gateway/gateway.sh \
  git.merge_local "merge-<run_id_8>-$(date +%s)" devops "<run_id>" \
  "<branch> /root/projects/openclaw-virtual-office"
```
- Переключается на main, `git merge --no-ff <branch>`, удаляет feature-ветку
- Требует CODE_REVIEW APPROVED в DB

### gateway.sh git.push_main (Федя)
```bash
/root/scripts/tool-gateway/gateway.sh \
  git.push_main "push-main-$(date +%s)" devops "<run_id>" \
  "/root/projects/openclaw-virtual-office"
```
- `git push origin main`
- Требует CODE_REVIEW APPROVED в DB

## Policy Rules

| Action | Policy |
|--------|--------|
| git.commit | Нет ограничений (локальный коммит) |
| git.push_feature | Запрещено пушить в main/master |
| git.merge_local | CODE_REVIEW APPROVED обязателен |
| git.push_main | CODE_REVIEW APPROVED обязателен |
| git.merge_main | CODE_REVIEW APPROVED обязателен + для CRITICAL нужен директорский approval |

## Naming Conventions

- Feature branches: `feature/<run_id_8>-<agent_id>`
  - Пример: `feature/ef7b811d-backend`
- Commit messages: Conventional Commits
  - `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Idempotency keys: `merge-<run_id_8>-<timestamp>`, `push-main-<timestamp>`
