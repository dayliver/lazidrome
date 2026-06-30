/**
 * 단일 사용자(자가 호스팅) 기준 전역 재생 세션 허브.
 * 마스터 1대가 state를 push하고, 리모트 클라이언트는 command를 보낸다.
 */

/** @typedef {{ deviceId: string, deviceName: string, connectedAt: number, socket: import('ws').WebSocket }} ClientRecord */

/** @type {Map<string, ClientRecord>} */
const clients = new Map()

const session = {
  masterDeviceId: null,
  masterDeviceName: null,
  state: null,
  updatedAt: 0,
}

function emptyState() {
  return {
    trackIds: [],
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isShuffle: false,
    repeatMode: 'off',
    track: null,
  }
}

function sanitizeState(raw) {
  if (!raw || typeof raw !== 'object') return null
  const trackIds = Array.isArray(raw.trackIds)
    ? raw.trackIds.map((id) => String(id)).filter(Boolean).slice(0, 500)
    : []
  const currentIndex = Number.isFinite(Number(raw.currentIndex)) ? Number(raw.currentIndex) : -1
  const track = raw.track && raw.track.id
    ? {
        id: String(raw.track.id),
        title: String(raw.track.title || '').slice(0, 300),
        artist: String(raw.track.artist || '').slice(0, 300),
        album: String(raw.track.album || '').slice(0, 300),
      }
    : null
  return {
    trackIds,
    currentIndex: trackIds.length ? Math.min(Math.max(-1, currentIndex), trackIds.length - 1) : -1,
    isPlaying: !!raw.isPlaying,
    currentTime: Number.isFinite(Number(raw.currentTime)) ? Math.max(0, Number(raw.currentTime)) : 0,
    duration: Number.isFinite(Number(raw.duration)) ? Math.max(0, Number(raw.duration)) : 0,
    isShuffle: !!raw.isShuffle,
    repeatMode: ['off', 'all', 'one'].includes(raw.repeatMode) ? raw.repeatMode : 'off',
    track,
  }
}

function send(socket, payload) {
  if (!socket || socket.readyState !== 1) return
  try {
    socket.send(JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

function buildSessionMessage() {
  return {
    type: 'session',
    masterDeviceId: session.masterDeviceId,
    masterDeviceName: session.masterDeviceName,
    state: session.state ?? emptyState(),
    updatedAt: session.updatedAt,
    devices: listDevices(),
  }
}

function listDevices() {
  return [...clients.values()].map((c) => ({
    deviceId: c.deviceId,
    deviceName: c.deviceName,
    isMaster: c.deviceId === session.masterDeviceId,
  }))
}

function broadcast(payload, exceptDeviceId = null) {
  for (const [id, client] of clients) {
    if (exceptDeviceId && id === exceptDeviceId) continue
    send(client.socket, payload)
  }
}

function setMaster(deviceId, deviceName) {
  const prev = session.masterDeviceId
  session.masterDeviceId = deviceId
  session.masterDeviceName = deviceName || clients.get(deviceId)?.deviceName || null
  if (prev !== deviceId) {
    broadcast({
      type: 'master_changed',
      masterDeviceId: session.masterDeviceId,
      masterDeviceName: session.masterDeviceName,
    })
  }
}

function clearMasterIf(deviceId) {
  if (session.masterDeviceId !== deviceId) return
  session.masterDeviceId = null
  session.masterDeviceName = null
  session.state = null
  session.updatedAt = 0
  broadcast({
    type: 'master_changed',
    masterDeviceId: null,
    masterDeviceName: null,
  })
}

export function getPlaybackSessionSnapshot() {
  return buildSessionMessage()
}

export function registerPlaybackClient({ socket, deviceId, deviceName }) {
  const id = String(deviceId || '').slice(0, 80)
  if (!id) {
    send(socket, { type: 'error', message: 'deviceId required' })
    socket.close()
    return null
  }

  const name = String(deviceName || 'Device').slice(0, 120)
  const existing = clients.get(id)
  if (existing?.socket && existing.socket !== socket) {
    try {
      existing.socket.close()
    } catch {
      /* ignore */
    }
  }

  clients.set(id, {
    deviceId: id,
    deviceName: name,
    connectedAt: Date.now(),
    socket,
  })

  send(socket, buildSessionMessage())
  broadcast({ type: 'devices', devices: listDevices() }, id)
  return id
}

export function unregisterPlaybackClient(deviceId) {
  if (!deviceId) return
  clients.delete(deviceId)
  clearMasterIf(deviceId)
  broadcast({ type: 'devices', devices: listDevices() })
  broadcast(buildSessionMessage())
}

export function handlePlaybackMessage(deviceId, raw) {
  const client = clients.get(deviceId)
  if (!client) return

  let msg
  try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    send(client.socket, { type: 'error', message: 'invalid json' })
    return
  }

  if (!msg || typeof msg.type !== 'string') return

  switch (msg.type) {
    case 'hello': {
      const name = String(msg.deviceName || client.deviceName).slice(0, 120)
      client.deviceName = name
      send(client.socket, buildSessionMessage())
      broadcast({ type: 'devices', devices: listDevices() }, deviceId)
      break
    }

    case 'claim_master': {
      setMaster(deviceId, client.deviceName)
      send(client.socket, buildSessionMessage())
      break
    }

    case 'release_master': {
      if (session.masterDeviceId === deviceId) {
        session.masterDeviceId = null
        session.masterDeviceName = null
        session.state = null
        session.updatedAt = 0
        broadcast({
          type: 'master_changed',
          masterDeviceId: null,
          masterDeviceName: null,
        })
      }
      break
    }

    case 'state': {
      const next = sanitizeState(msg.state)
      if (!next) return
      if (!session.masterDeviceId || session.masterDeviceId === deviceId) {
        setMaster(deviceId, client.deviceName)
        session.state = next
        session.updatedAt = Date.now()
        broadcast(
          {
            type: 'state',
            state: session.state,
            masterDeviceId: session.masterDeviceId,
            masterDeviceName: session.masterDeviceName,
            updatedAt: session.updatedAt,
          },
          deviceId,
        )
      }
      break
    }

    case 'command': {
      const command = String(msg.command || '').slice(0, 40)
      if (!command) return
      if (deviceId === session.masterDeviceId) return
      if (!session.masterDeviceId) {
        send(client.socket, { type: 'error', message: 'no_active_player' })
        return
      }
      const master = clients.get(session.masterDeviceId)
      if (!master) {
        send(client.socket, { type: 'error', message: 'master_offline' })
        clearMasterIf(session.masterDeviceId)
        return
      }
      send(master.socket, {
        type: 'command',
        command,
        payload: msg.payload && typeof msg.payload === 'object' ? msg.payload : {},
        fromDeviceId: deviceId,
        fromDeviceName: client.deviceName,
      })
      break
    }

    default:
      break
  }
}
