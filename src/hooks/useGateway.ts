import type { GatewayEventFrame } from '../lib/openclaw-types'
import { useState, useEffect, useRef, useCallback } from 'react'
import { get } from 'lodash-es'
import { useWebsocket } from './useWebsocket'
import { tryJsonParse } from '../utils'
import {
  getOpenClawVersion,
  getGatewayToken,
  startOpenClaw,
  stopOpenClaw,
} from '../lib/openclaw-commands'

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function useToken() {
  const tokenRef = useRef('')

  return useCallback(async () => {
    if (tokenRef.current) return tokenRef.current
    return getGatewayToken()
  }, [])
}

export function useGateway() {
  const [version, setVersion] = useState('')
  const pendingRef = useRef(
    new Map<
      string,
      { resolve: (v: unknown) => void; reject: (e: Error) => void }
    >()
  )
  const eventCallbacksRef = useRef<Array<(evt: GatewayEventFrame) => void>>([])
  const sendRef = useRef<(data: string) => void>(() => {
    throw new Error('not connected')
  })

  const getToken = useToken()

  const onMessage = (event: MessageEvent) => {
    const data = tryJsonParse(String(event.data))

    if (data.type === 'res') {
      const id = data.id as string
      const entry = pendingRef.current.get(id)
      if (entry) {
        pendingRef.current.delete(id)
        if (data.ok === false) {
          entry.reject(new Error(get(data, 'error.message', 'Request failed')))
        } else {
          entry.resolve(data.payload)
        }
      }
      return
    }

    if (data.type === 'event') {
      const evt = data as unknown as GatewayEventFrame
      if (evt.event === 'connect.challenge') {
        doConnect()
        return
      }
      for (const cb of eventCallbacksRef.current) {
        try {
          cb(evt)
        } catch {
          //
        }
      }
    }
  }

  const doConnect = useCallback(async () => {
    const params = {
      userAgent: get(navigator, 'userAgent', ''),
      locale: get(navigator, 'language', 'en'),
      auth: { token: await getToken() },
      caps: ['tool-events'],
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'openclaw-control-ui',
        version: '0.2.0',
        mode: 'ui',
      },
      role: 'operator',
      scopes: [
        'operator.admin',
        'operator.read',
        'operator.write',
        'operator.approvals',
        'operator.pairing',
      ],
    }
    const id = generateId()
    const send = sendRef.current
    new Promise<void>((resolve, reject) => {
      pendingRef.current.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      })
      send(JSON.stringify({ type: 'req', id, method: 'connect', params }))
    }).catch(() => {
      pendingRef.current.delete(id)
    })
  }, [getToken])

  const {
    disconnect: wsDisconnect,
    connect: wsConnect,
    send: wsSend,
    readyState,
  } = useWebsocket('', {
    manual: true,
    onOpen: doConnect,
    onMessage,
    onClose: () => {
      for (const [, entry] of pendingRef.current) {
        entry.reject(new Error('gateway closed'))
      }
      pendingRef.current.clear()
    },
  })

  const clientRef = useRef({
    request<T = unknown>(
      method: string,
      params?: Record<string, unknown>
    ): Promise<T> {
      return new Promise((resolve, reject) => {
        const id = generateId()
        pendingRef.current.set(id, {
          resolve: resolve as (v: unknown) => void,
          reject,
        })
        wsSend(
          JSON.stringify({ type: 'req', id, method, params: params ?? {} })
        )
      })
    },
    onEvent(callback: (evt: GatewayEventFrame) => void) {
      eventCallbacksRef.current.push(callback)
      return () => {
        eventCallbacksRef.current = eventCallbacksRef.current.filter(
          (cb) => cb !== callback
        )
      }
    },
  })

  const start = useCallback(async (): Promise<string> => {
    const gatewayUrl = await startOpenClaw()
    wsConnect(gatewayUrl)
    return gatewayUrl
  }, [wsConnect])

  const stop = useCallback(async () => {
    wsDisconnect()
    await stopOpenClaw()
  }, [wsDisconnect])

  useEffect(() => {
    start()
    getOpenClawVersion()
      .then(setVersion)
      .catch(() => {})
  }, [start])

  return {
    gatewayConnected: readyState === WebSocket.OPEN,
    client: clientRef.current,
    version,
    start,
    stop,
  }
}
