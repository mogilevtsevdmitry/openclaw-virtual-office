import { useEffect, useRef, useState } from 'react'
import styles from './TokenWidget.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionStatus {
  tokensUsed: number
  tokensTotal: number
  tokensPercent: number
  model: string
  cacheHitRate: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000

const MOCK_DATA: SessionStatus = {
  tokensUsed: 82_000,
  tokensTotal: 200_000,
  tokensPercent: 41,
  model: 'claude-sonnet-4-6',
  cacheHitRate: 99,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatK(n: number): string {
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

function barColor(percent: number): 'green' | 'yellow' | 'red' {
  if (percent >= 90) return 'red'
  if (percent >= 70) return 'yellow'
  return 'green'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useSessionStatus() {
  const [data, setData] = useState<SessionStatus | null>(null)
  const [stale, setStale] = useState(false)
  const lastKnownRef = useRef<SessionStatus | null>(null)

  const fetch = async () => {
    try {
      const res = await window.fetch('/api/session-status')
      if (res.status === 404) {
        if (!lastKnownRef.current) {
          lastKnownRef.current = MOCK_DATA
          setData(MOCK_DATA)
        }
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: SessionStatus = await res.json()
      lastKnownRef.current = json
      setData(json)
      setStale(false)
    } catch {
      if (lastKnownRef.current) {
        setStale(true)
      } else {
        lastKnownRef.current = MOCK_DATA
        setData(MOCK_DATA)
      }
    }
  }

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data: data ?? lastKnownRef.current, stale }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TokenWidget() {
  const { data, stale } = useSessionStatus()

  if (!data) return null

  const color = barColor(data.tokensPercent)

  return (
    <div className={`${styles.widget} ${stale ? styles.stale : ''}`}>
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
      </div>
    </div>
  )
}
