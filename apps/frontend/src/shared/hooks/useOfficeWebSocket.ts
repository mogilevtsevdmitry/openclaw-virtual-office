import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useAuthStore } from '@features/auth/authStore'
import { useOfficeStore } from '@features/office/officeStore'
import type { TypedWsEvent } from '@shared/types'

// Use same origin through proxy/tunnel; fallback to direct backend in local dev
const WS_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin
const RECONNECT_DELAY_MS = 3000

interface SubscribePayload {
  tenantId: string
  floorId: string
  sinceEventId: string | null
}

export function useOfficeWebSocket(floorId: string) {
  const socketRef = useRef<Socket | null>(null)
  // Select only primitives — avoids re-render on unrelated store changes
  const token = useAuthStore((s) => s.token)
  const tenantId = useAuthStore((s) => s.tenantId)

  useEffect(() => {
    if (!token || !tenantId) return

    // Socket.IO: connect to /realtime namespace via standard /socket.io engine path
    // path='/realtime' was wrong — that's the namespace, not the engine path
    const socket = io(`${WS_URL}/realtime`, {
      path: '/socket.io',
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionAttempts: Infinity,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      // Read lastEventId fresh from store at connect time — no stale closure
      const lastEventId = useOfficeStore.getState().lastEventId
      const payload: SubscribePayload = {
        tenantId,
        floorId,
        sinceEventId: lastEventId,
      }
      socket.emit('subscribe', payload)
    })

    // Backend broadcasts on 'domain_event', not 'event'
    socket.on('domain_event', (envelope: TypedWsEvent) => {
      dispatchWsEvent(envelope)
    })

    socket.on('connect_error', (err) => {
      console.warn('[WS] connect error:', err.message)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[WS] disconnected:', reason)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, tenantId, floorId])

  return socketRef
}

function dispatchWsEvent(envelope: TypedWsEvent) {
  const { eventId, eventType, payload } = envelope
  const store = useOfficeStore.getState()

  switch (eventType) {
    case 'agent.hired':
      store.applyAgentHired(
        payload as Parameters<typeof store.applyAgentHired>[0],
        eventId,
      )
      break
    case 'desk.placed':
      store.applyDeskPlaced(
        payload as Parameters<typeof store.applyDeskPlaced>[0],
        eventId,
      )
      break
    case 'presence.state_changed':
      store.applyPresenceChanged(
        payload as Parameters<typeof store.applyPresenceChanged>[0],
        eventId,
      )
      break
    case 'message.created':
      store.applyMessagePosted(
        payload as Parameters<typeof store.applyMessagePosted>[0],
        eventId,
      )
      break
    case 'zone.created':
      store.applyZoneCreated(
        payload as Parameters<typeof store.applyZoneCreated>[0],
        eventId,
      )
      break
    default:
      break
  }

  store.setLastEventId(eventId)
}
