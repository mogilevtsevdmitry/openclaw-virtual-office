import { useEffect, useRef } from 'react'
import { useOfficeStore } from './officeStore'
import styles from './ChatPanel.module.css'

export function ChatPanel() {
  const messages = useOfficeStore((s) => s.chatMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Чат</h2>
      <div className={styles.feed}>
        {messages.map((msg) => (
          <div key={msg.messageId} className={styles.message}>
            <span className={styles.author}>{msg.agentName}</span>
            <span className={styles.text}>{msg.text}</span>
            <span className={styles.time}>
              {new Date(msg.postedAt).toLocaleTimeString('ru', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className={styles.empty}>Сообщений пока нет</p>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
