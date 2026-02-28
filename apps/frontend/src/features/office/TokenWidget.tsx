import { useEffect, useRef, useState } from 'react'
import styles from './TokenWidget.module.css'

interface SessionStatus {
  tokensUsed: number
  tokensTotal: number
  tokensPercent: number
  model: string
  cacheHitRate: number
}

const POLL_INTERVAL_MS = 30_000

function formatK(n: number): string {
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function barColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent >= 90) return 'red'
  if (percent >= 70) return 'yellow'
  return 'green'
}

function useSessionStatus() {
  const [data, setData] = useState<SessionStatus | null>(null)
  const [stale, setStale] = useState(false)
  const [loading, setLoading] = useState(true)
  const lastKnownRef = useRef<SessionStatus | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await window.fetch('/api/session-status')
      if (!res.ok) {
        // Не показываем мок — оставляем последнее известное или null
        if (lastKnownRef.current) setStale(true)
        return
      }
      const json: SessionStatus = await res.json()
      lastKnownRef.current = json
      setData(json)
      setStale(false)
    } catch {
      if (lastKnownRef.current) setStale(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data: data ?? lastKnownRef.current, stale, loading }
}

export function TokenWidget() {
  const { data, stale, loading } = useSessionStatus()

  // Пока грузится — не показываем ничего
  if (loading && !data) return null

  // Нет данных — показываем минималистичный плейсхолдер
  if (!data) {
    return (
      <div className={styles.widget}>
        <div className={styles.model}>🧠 загрузка...</div>
      </div>
    )
  }

  const color = barColor(data.tokensPercent)
  const isWarning = data.tokensPercent >= 80
  const isCritical = data.tokensPercent >= 90

  return (
    <div className={`${styles.widget} ${stale ? styles.stale : ''} ${isCritical ? styles.critical : isWarning ? styles.warning : ''}`}>
      <div className={styles.model}>🧠 {data.model}</div>

      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressBar} ${styles[color]}`}
          style={{ width: `${Math.min(data.tokensPercent, 100)}%` }}
        />
      </div>

      <div className={styles.row}>
        <span>{formatK(data.tokensUsed)} / {formatK(data.tokensTotal)} токенов</span>
        <span>{data.tokensPercent}%</span>
      </div>

      <div className={styles.row}>
        <span>💾 кэш {data.cacheHitRate}%</span>
        {stale && <span style={{ color: '#888', fontSize: '10px' }}>↻</span>}
      </div>

      {isWarning && !isCritical && (
        <div className={styles.warningBanner}>
          ⚠️ Контекст заполнен на {data.tokensPercent}%
        </div>
      )}
      {isCritical && (
        <div className={styles.criticalBanner}>
          🔴 Контекст почти заполнен! {data.tokensPercent}%
        </div>
      )}
    </div>
  )
}
