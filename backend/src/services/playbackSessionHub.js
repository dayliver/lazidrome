/**
 * 단일 사용자(자가 호스팅) 기준 전역 재생 세션 허브.
 * 마스터 1대가 state를 push하고, 리모트 클라이언트는 command를 보낸다.
 *
 * 하트비트: 반쯤 열린 소켓(모바일 백그라운드 등)은 close 이벤트가 늦거나 아예 안 온다.
 * 그대로 두면 "이 기기가 재생 중"이라는 표시가 거짓말이 되므로, 주기적으로 ping을 보내고
 * 응답이 끊긴 클라이언트는 끊어 목록·마스터에서 내린다.
 */

import {
  saveLastPlaybackSession,
  loadLastPlaybackSession,
} from '../repositories/playbackSessionRepository.js'
import { touchDevice } from '../repositories/deviceRepository.js'

const PING_INTERVAL_MS = 15_000;
/** 이 시간 동안 앱 레벨 pong·메시지가 없으면 죽은 것으로 본다 */
const CLIENT_TIMEOUT_MS = 90_000;
/** 이 시간을 넘기면 아직 끊지는 않되 UI에 "응답 없음"으로 표시 */
const CLIENT_STALE_MS = PING_INTERVAL_MS * 2;

/** @typedef {{ deviceId: string, deviceName: string, connectedAt: number, lastSeenAt: number, socket: import('ws').WebSocket }} ClientRecord */

/** @type {Map<string, ClientRecord>} */
const clients = new Map()

const session = {
  masterDeviceId: null,
  masterDeviceName: null,
  state: null,
  updatedAt: 0,
}

/** @type {NodeJS.Timeout | null} */
let heartbeatTimer = null

/** 재시작을 넘겨 살아남는 "마지막으로 본 재생" — 라이브 세션이 없을 때 표시용 */
let lastSession = loadLastPlaybackSession()
/** 매 state push마다 DB를 때리지 않도록 (푸시는 2.5초마다 온다) */
const LAST_SESSION_PERSIST_MS = 30_000
let lastSessionPersistedAt = 0

function rememberLastSession(deviceId, deviceName, state, { force = false } = {}) {
  if (!deviceId) return
  lastSession = {
    deviceId,
    deviceName: deviceName ?? null,
    track: state?.track ?? null,
    isPlaying: !!state?.isPlaying,
    at: now(),
  }
  if (!force && now() - lastSessionPersistedAt < LAST_SESSION_PERSIST_MS) return
  lastSessionPersistedAt = now()
  saveLastPlaybackSession(lastSession)
}

function now() {
  return Date.now()
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
    // 클라이언트 시계가 서버와 어긋나도 "N초 전"이 맞도록 서버 기준 now를 함께 보낸다
    serverNow: now(),
    devices: listDevices(),
    lastSession,
  }
}

function listDevices() {
  const t = now()
  return [...clients.values()].map((c) => ({
    deviceId: c.deviceId,
    deviceName: c.deviceName,
    isMaster: c.deviceId === session.masterDeviceId,
    lastSeenAt: c.lastSeenAt,
    // ping 두 번을 놓친 상태 — 아직 끊지는 않지만 UI에서 "응답 없음"으로 표시한다
    stale: t - c.lastSeenAt > CLIENT_STALE_MS,
  }))
}

/**
 * ping 브로드캐스트 + 응답 끊긴 클라이언트 정리.
 * 반쯤 열린 소켓을 여기서 걷어내야 기기 목록과 마스터 표시가 현실과 맞는다.
 *
 * 살아있음의 근거는 **앱 레벨 pong**(`{type:'pong'}`)뿐이다.
 * 프로토콜 ping/pong은 브라우저가 JS와 무관하게 자동 응답하므로, 탭이 얼어붙어도
 * "살아있음"으로 보이게 만든다 — keepalive 용도로만 보내고 신선도 판정엔 쓰지 않는다.
 */
function heartbeatTick() {
  const t = now()
  const dead = []
  for (const client of clients.values()) {
    if (t - client.lastSeenAt > CLIENT_TIMEOUT_MS) {
      dead.push(client.deviceId)
      continue
    }
    try {
      client.socket.ping?.() // 중간 프록시 idle timeout 방지용
    } catch {
      /* ignore */
    }
    send(client.socket, { type: 'ping', at: t })
  }

  for (const deviceId of dead) {
    const client = clients.get(deviceId)
    try {
      client?.socket?.terminate?.() ?? client?.socket?.close?.()
    } catch {
      /* ignore */
    }
    unregisterPlaybackClient(deviceId)
  }

  // stale 플래그는 시간이 흐르면서 바뀌는데 broadcast 계기가 따로 없다.
  // 바뀐 순간에 한 번 밀어주지 않으면 "응답 없음" 배지가 화면에 영영 안 뜬다.
  const staleNow = new Set(
    [...clients.values()].filter((c) => t - c.lastSeenAt > CLIENT_STALE_MS).map((c) => c.deviceId)
  )
  if (!sameIdSet(staleNow, lastStaleIds)) {
    lastStaleIds = staleNow
    broadcast({ type: 'devices', devices: listDevices() })
  }
}

/** @type {Set<string>} */
let lastStaleIds = new Set()

function sameIdSet(a, b) {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

/** 첫 클라이언트가 붙을 때 시작, 마지막이 나가면 멈춘다 */
function ensureHeartbeat() {
  if (heartbeatTimer || !clients.size) return
  heartbeatTimer = setInterval(heartbeatTick, PING_INTERVAL_MS)
  heartbeatTimer.unref?.()
}

function stopHeartbeatIfIdle() {
  if (clients.size || !heartbeatTimer) return
  clearInterval(heartbeatTimer)
  heartbeatTimer = null
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
  rememberLastSession(deviceId, session.masterDeviceName, session.state, { force: true })
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
    connectedAt: now(),
    lastSeenAt: now(),
    socket,
  })

  // 재생 기록이 아직 없어도 레지스트리에 남겨 설정에서 이름을 붙일 수 있게 한다
  try {
    touchDevice(id, name)
  } catch {
    /* 레지스트리 실패가 재생 동기화를 막지는 않는다 */
  }

  ensureHeartbeat()
  send(socket, buildSessionMessage())
  broadcast({ type: 'devices', devices: listDevices() }, id)
  return id
}

export function unregisterPlaybackClient(deviceId) {
  if (!deviceId) return
  if (!clients.delete(deviceId)) return
  clearMasterIf(deviceId)
  broadcast({ type: 'devices', devices: listDevices() })
  broadcast(buildSessionMessage())
  stopHeartbeatIfIdle()
}

export function handlePlaybackMessage(deviceId, raw) {
  const client = clients.get(deviceId)
  if (!client) return

  // 어떤 메시지든 도착했다면 그 소켓은 살아 있다
  client.lastSeenAt = now()

  let msg
  try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    send(client.socket, { type: 'error', message: 'invalid json' })
    return
  }

  if (!msg || typeof msg.type !== 'string') return

  switch (msg.type) {
    case 'pong':
      // lastSeenAt은 위에서 이미 갱신됨
      break

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
        session.updatedAt = now()
        rememberLastSession(deviceId, client.deviceName, next)
        broadcast(
          {
            type: 'state',
            state: session.state,
            masterDeviceId: session.masterDeviceId,
            masterDeviceName: session.masterDeviceName,
            updatedAt: session.updatedAt,
            serverNow: now(),
          },
          deviceId,
        )
      }
      break
    }

    /**
     * 모든 기기 정지 — 마스터만이 아니라 연결된 전부에 pause를 보낸다.
     * "나도 모르게 다른 기기가 재생 중"에 대한 직접적인 탈출구라, 마스터 여부와
     * 무관하게 아무 기기에서나 누를 수 있어야 한다.
     */
    case 'stop_all': {
      broadcast({
        type: 'command',
        command: 'pause',
        payload: {},
        fromDeviceId: deviceId,
        fromDeviceName: client.deviceName,
        broadcastStop: true,
      })
      session.masterDeviceId = null
      session.masterDeviceName = null
      session.state = null
      session.updatedAt = 0
      broadcast({ type: 'master_changed', masterDeviceId: null, masterDeviceName: null })
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
