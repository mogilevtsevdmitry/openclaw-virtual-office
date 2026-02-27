import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { agentsApi } from '@shared/api'
import { useOfficeStore } from './officeStore'
import styles from './AddAgentForm.module.css'

export function AddAgentForm() {
  // useShallow — zones это объект, без shallow каждый рендер новая ссылка
  const deptList = useOfficeStore(useShallow((s) => Object.values(s.zones)))

  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      await agentsApi.hireAgent({
        idempotencyKey: `hire-${Date.now()}`,
        name,
        role,
        departmentId,
      })
      setSuccess(true)
      setName('')
      setRole('')
      setDepartmentId('')
    } catch {
      setError('Ошибка при найме агента')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.title}>Нанять агента</h3>

      <input
        className={styles.input}
        placeholder="Имя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className={styles.input}
        placeholder="Должность"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        required
      />

      {deptList.length > 0 ? (
        <select
          className={styles.input}
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          required
        >
          <option value="">— Выбрать отдел —</option>
          {deptList.map((z) => (
            <option key={z.zoneId} value={z.zoneId}>
              {z.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={styles.input}
          placeholder="ID отдела"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          required
        />
      )}

      {error && <p className={styles.error}>{error}</p>}
      {success && <p className={styles.success}>Агент нанят! Ожидаем событие...</p>}

      <button type="submit" className={styles.btn} disabled={loading}>
        {loading ? 'Отправляем...' : 'Нанять'}
      </button>
    </form>
  )
}
