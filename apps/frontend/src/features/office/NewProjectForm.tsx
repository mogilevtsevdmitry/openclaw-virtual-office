import { useState } from 'react'
import { apiClient } from '@shared/api'
import styles from './NewProjectForm.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProjectType = 'telegram_bot' | 'web_app'

interface BootstrapResponse {
  projectId: string
  runId?: string
}

interface NewProjectFormProps {
  onClose: () => void
  onCreated?: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewProjectForm({ onClose, onCreated }: NewProjectFormProps) {
  const [idea, setIdea] = useState('')
  const [type, setType] = useState<ProjectType>('telegram_bot')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BootstrapResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const trimmed = idea.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const res = await apiClient.post<BootstrapResponse>('/bootstrap', {
        idea: trimmed,
        type,
      })
      setResult(res.data)
      onCreated?.()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Ошибка при запуске проекта')
    } finally {
      setLoading(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>🚀 Новый проект</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {result ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✅</div>
              <p className={styles.successText}>Проект запущен!</p>
              <p className={styles.projectId}>ID: {result.projectId}</p>
              {result.runId && (
                <p className={styles.runId}>Run: {result.runId}</p>
              )}
              <button className={styles.doneBtn} onClick={onClose}>
                Готово
              </button>
            </div>
          ) : (
            <>
              <label className={styles.label}>Идея</label>
              <textarea
                className={styles.textarea}
                placeholder="Опиши идею проекта..."
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={4}
                disabled={loading}
              />

              <label className={styles.label}>Тип</label>
              <div className={styles.radioGroup}>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="project-type"
                    value="telegram_bot"
                    checked={type === 'telegram_bot'}
                    onChange={() => setType('telegram_bot')}
                    disabled={loading}
                    className={styles.radio}
                  />
                  Telegram Bot
                </label>
                <label className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="project-type"
                    value="web_app"
                    checked={type === 'web_app'}
                    onChange={() => setType('web_app')}
                    disabled={loading}
                    className={styles.radio}
                  />
                  Web App
                </label>
              </div>

              {error && <p className={styles.errorText}>{error}</p>}

              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={loading || !idea.trim()}
              >
                {loading ? 'Запускаем...' : 'Запустить →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
