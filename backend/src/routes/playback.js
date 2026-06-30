import websocket from '@fastify/websocket'
import {
  getPlaybackSessionSnapshot,
  registerPlaybackClient,
  unregisterPlaybackClient,
  handlePlaybackMessage,
} from '../services/playbackSessionHub.js'

function verifyWsToken(fastify, token) {
  if (!token || typeof token !== 'string') return null
  try {
    return fastify.jwt.verify(token)
  } catch {
    return null
  }
}

export default async function playbackRoutes(fastify) {
  await fastify.register(websocket)

  fastify.get('/api/playback/session', async () => getPlaybackSessionSnapshot())

  fastify.get('/api/playback/ws', { websocket: true }, (socket, request) => {
    const token = request.query?.token
    const user = verifyWsToken(fastify, token)
    if (!user) {
      socket.send(JSON.stringify({ type: 'error', message: 'unauthorized' }))
      socket.close()
      return
    }

    let deviceId = null

    socket.on('message', (data) => {
      const raw = data?.toString?.() ?? String(data)
      if (!deviceId) {
        let hello
        try {
          hello = JSON.parse(raw)
        } catch {
          socket.send(JSON.stringify({ type: 'error', message: 'hello required' }))
          socket.close()
          return
        }
        if (hello?.type !== 'hello' || !hello.deviceId) {
          socket.send(JSON.stringify({ type: 'error', message: 'hello required' }))
          socket.close()
          return
        }
        deviceId = registerPlaybackClient({
          socket,
          deviceId: hello.deviceId,
          deviceName: hello.deviceName,
        })
        if (!deviceId) return
        if (hello.claimMaster) {
          handlePlaybackMessage(deviceId, { type: 'claim_master' })
        }
        return
      }
      handlePlaybackMessage(deviceId, raw)
    })

    socket.on('close', () => {
      if (deviceId) unregisterPlaybackClient(deviceId)
    })

    socket.on('error', () => {
      if (deviceId) unregisterPlaybackClient(deviceId)
    })
  })
}
