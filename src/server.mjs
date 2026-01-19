import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'
import { SessionManager } from './session.mjs'
import { RoomManager } from './room.mjs'
import { MessageStore } from './message.mjs'
import { InviteManager } from './invite.mjs'
import { Persistence } from './persistence.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const publicDir = join(__dirname, '../public')

export function createChatService ({ httpServer, router, options = {}, onUserMessage }) {
  const sessions = new SessionManager()
  const rooms = new RoomManager()
  const messages = new MessageStore()
  const invites = new InviteManager()
  const inviteTtlHours = options.inviteTtlHours || 24

  let persistence = null
  if (options.persistPath) {
    persistence = new Persistence(options.persistPath)

    const persistedRooms = persistence.loadRooms()
    for (const room of persistedRooms) {
      rooms.rooms.set(room.roomId, room)
      if (!rooms.memberships.has(room.roomId)) {
        rooms.memberships.set(room.roomId, [])
      }
    }

    const persistedMemberships = persistence.loadMemberships()
    for (const mem of persistedMemberships) {
      rooms.addMember(mem.roomId, mem.sessionId, mem.joinedAt)
    }

    const persistedMessages = persistence.loadMessages()
    for (const msg of persistedMessages) {
      messages.importMessage(msg)
    }

    const persistedInvites = persistence.loadInvites()
    const inviteEvents = persistence.loadInviteEvents()
    for (const inv of persistedInvites) {
      if (!inviteEvents.created.has(inv.tokenHash)) continue
      invites.importInvite(inv)
      if (inviteEvents.consumed.has(inv.tokenHash)) {
        invites.markConsumed(inv.tokenHash)
      }
    }
  }

  const generalRoom = rooms.ensureRoom('general', 'public', 'system')
  if (persistence) persistence.persistRoom(generalRoom)

  registerRoutes(router)

  const wss = new WebSocketServer({ noServer: true })
  const wsConnections = new Map()

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '/', 'http://localhost')
    if (url.pathname !== '/') {
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request)
    })
  })

  wss.on('connection', (ws) => {
    let sessionId = null

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data)
        handleMessage(ws, msg)
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid JSON'
        }))
      }
    })

    ws.on('close', () => {
      if (!sessionId) return
      wsConnections.delete(sessionId)
      broadcast({
        type: 'user.left',
        payload: { sessionId }
      }, sessionId)
    })

    function handleMessage (socket, msg) {
      const { type, payload } = msg

      if (type === 'hello') {
        if (!payload?.nickname) return
        const requestedSessionId = payload?.sessionId
        const session = sessions.getOrCreateSession(requestedSessionId, payload.nickname)
        sessionId = session.sessionId
        wsConnections.set(sessionId, socket)

        rooms.addMember(generalRoom.roomId, sessionId)
        if (persistence) {
          persistence.persistMembership(generalRoom.roomId, sessionId, new Date())
        }

        const userRooms = rooms.getRoomsForSession(sessionId)
        const messagesByRoomId = {}
        for (const room of userRooms) {
          messagesByRoomId[room.roomId] = messages.getHistory(room.roomId)
        }

        const users = listConnectedUsers()

        socket.send(JSON.stringify({
          type: 'state.init',
          payload: {
            session,
            rooms: userRooms,
            messagesByRoomId,
            defaultRoomId: generalRoom.roomId,
            users
          }
        }))

        broadcast({
          type: 'user.joined',
          payload: { sessionId, nickname: session.nickname }
        }, sessionId)
        return
      }

      if (!sessionId) return

      if (type === 'room.create') {
        const name = payload?.name?.trim()
        const visibility = payload?.visibility

        if (!name) {
          sendError(socket, 'Room name required')
          return
        }

        if (rooms.getRoomByName(name)) {
          sendError(socket, 'Room name already exists')
          return
        }

        if (visibility !== 'public' && visibility !== 'private') {
          sendError(socket, 'Invalid room visibility')
          return
        }

        const room = rooms.createRoom(name, visibility, sessionId)
        rooms.addMember(room.roomId, sessionId)

        if (persistence) {
          persistence.persistRoom(room)
          persistence.persistMembership(room.roomId, sessionId, new Date())
        }

        let invite = null
        if (visibility === 'private') {
          invite = invites.createInvite(room.roomId, inviteTtlHours)
          if (persistence) persistence.persistInvite(invite)
        }

        const payloadData = { room, invite: invite ? { token: invite.token, expiresAt: invite.expiresAt } : null }

        if (visibility === 'public') {
          broadcast({ type: 'room.created', payload: payloadData })
        } else {
          socket.send(JSON.stringify({ type: 'room.created', payload: payloadData }))
        }

        sendRoomJoined(room.roomId, sessionId)
        return
      }

      if (type === 'room.join') {
        const roomId = payload?.roomId
        const room = rooms.getRoom(roomId)

        if (!room) {
          sendError(socket, 'Room not found')
          return
        }

        if (room.visibility === 'private' && !rooms.isMember(roomId, sessionId)) {
          sendError(socket, 'Cannot join private room')
          return
        }

        const alreadyMember = rooms.isMember(roomId, sessionId)
        if (!alreadyMember) {
          rooms.addMember(roomId, sessionId)
          if (persistence) persistence.persistMembership(roomId, sessionId, new Date())
        }

        sendRoomJoined(roomId, sessionId)
        return
      }

      if (type === 'room.joinByInvite') {
        const inviteToken = payload?.inviteToken
        const result = invites.consumeInvite(inviteToken)

        if (!result.success) {
          sendError(socket, result.error)
          return
        }

        const roomId = result.roomId
        rooms.addMember(roomId, sessionId)

        if (persistence) {
          persistence.persistMembership(roomId, sessionId, new Date())
          persistence.recordInviteConsumption(result.tokenHash)
        }

        sendRoomJoined(roomId, sessionId)
        return
      }

      if (type === 'message.send') {
        const roomId = payload?.roomId
        const text = payload?.text?.trim()
        if (!roomId || !text) return

        const room = rooms.getRoom(roomId)
        if (!room) {
          sendError(socket, 'Room not found')
          return
        }

        if (!rooms.isMember(roomId, sessionId)) {
          sendError(socket, 'Join the room before sending messages')
          return
        }

        const session = sessions.getSession(sessionId)
        const message = messages.addMessage(roomId, sessionId, session.nickname, text)

        if (persistence) persistence.persistMessage(message)

        broadcastToRoom(roomId, { type: 'message.new', payload: message })
        if (onUserMessage) onUserMessage(message)
      }

      if (type === 'dm.start') {
        const nickname = payload?.nickname?.trim()
        if (!nickname) {
          sendError(socket, 'Nickname required')
          return
        }

        const targetSession = findConnectedSessionByNickname(nickname)
        if (!targetSession) {
          sendError(socket, 'User not found')
          return
        }

        if (targetSession.sessionId === sessionId) {
          sendError(socket, 'Cannot DM yourself')
          return
        }

        const room = getOrCreateDirectRoom(sessionId, targetSession.sessionId)
        sendRoomCreatedToSessions(room, [sessionId, targetSession.sessionId])
        sendRoomJoined(room.roomId, sessionId)
      }
    }
  })

  function sendRoomJoined (roomId, joiningSessionId) {
    const room = rooms.getRoom(roomId)
    const session = sessions.getSession(joiningSessionId)
    const history = messages.getHistory(roomId)

    const joinerPayload = {
      roomId,
      sessionId: joiningSessionId,
      nickname: session.nickname,
      room,
      history,
      isSelf: true
    }

    sendToSession(joiningSessionId, { type: 'room.joined', payload: joinerPayload })

    broadcastToRoom(roomId, {
      type: 'room.joined',
      payload: {
        roomId,
        sessionId: joiningSessionId,
        nickname: session.nickname,
        isSelf: false
      }
    }, joiningSessionId)
  }

  function sendRoomCreatedToSessions (room, sessionIds) {
    const payload = { room, invite: null }
    for (const id of sessionIds) {
      sendToSession(id, { type: 'room.created', payload })
    }
  }

  function listConnectedUsers () {
    const users = []
    for (const id of wsConnections.keys()) {
      const session = sessions.getSession(id)
      if (session) users.push({ sessionId: id, nickname: session.nickname })
    }
    return users
  }

  function findConnectedSessionByNickname (nickname) {
    const lower = nickname.toLowerCase()
    for (const id of wsConnections.keys()) {
      const session = sessions.getSession(id)
      if (session?.nickname?.toLowerCase() === lower) return session
    }
    return null
  }

  function getOrCreateDirectRoom (sessionIdA, sessionIdB) {
    const existing = findDirectRoom(sessionIdA, sessionIdB)
    if (existing) return existing

    const sessionA = sessions.getSession(sessionIdA)
    const sessionB = sessions.getSession(sessionIdB)
    const names = [sessionA.nickname, sessionB.nickname].sort((a, b) => a.localeCompare(b))
    let name = `dm:${names.join(',')}`

    if (rooms.getRoomByName(name)) {
      name = `${name}-${randomUUID().slice(0, 8)}`
    }

    const room = rooms.createRoom(name, 'private', sessionIdA)
    rooms.addMember(room.roomId, sessionIdA)
    rooms.addMember(room.roomId, sessionIdB)

    if (persistence) {
      persistence.persistRoom(room)
      persistence.persistMembership(room.roomId, sessionIdA, new Date())
      persistence.persistMembership(room.roomId, sessionIdB, new Date())
    }

    return room
  }

  function findDirectRoom (sessionIdA, sessionIdB) {
    for (const room of rooms.rooms.values()) {
      if (room.visibility !== 'private') continue
      if (!room.name.startsWith('dm:')) continue
      const members = rooms.getMembers(room.roomId)
      const ids = members.map(member => member.sessionId)
      if (ids.includes(sessionIdA) && ids.includes(sessionIdB) && ids.length === 2) {
        return room
      }
    }
    return null
  }

  function sendError (socket, message) {
    socket.send(JSON.stringify({ type: 'error', error: message }))
  }

  function sendToSession (sessionId, msg) {
    const socket = wsConnections.get(sessionId)
    if (!socket || socket.readyState !== 1) return
    socket.send(JSON.stringify(msg))
  }

  function broadcast (msg, excludeSessionId = null) {
    const data = JSON.stringify(msg)
    for (const [id, socket] of wsConnections.entries()) {
      if (excludeSessionId && id === excludeSessionId) continue
      if (socket.readyState === 1) socket.send(data)
    }
  }

  function broadcastToRoom (roomId, msg, excludeSessionId = null) {
    const members = rooms.getMembers(roomId)
    const data = JSON.stringify(msg)

    for (const member of members) {
      if (excludeSessionId && member.sessionId === excludeSessionId) continue
      const socket = wsConnections.get(member.sessionId)
      if (socket && socket.readyState === 1) {
        socket.send(data)
      }
    }
  }

  return {
    wss,
    sessions,
    rooms,
    messages,
    invites,
    persistence,
    handleHubotSend (roomId, text) {
      if (!roomId || !text) return
      const message = messages.addMessage(roomId, 'hubot', 'hubot', text)
      if (persistence) persistence.persistMessage(message)
      broadcastToRoom(roomId, { type: 'message.new', payload: message })
    }
  }
}

function registerRoutes (router) {
  if (!router) return

  router.get('/', (req, res) => {
    try {
      const html = readFileSync(join(publicDir, 'index.html'), 'utf-8')
      res.type('html').send(html)
    } catch (error) {
      console.error(error)
      res.status(500).send('Internal Server Error')
    }
  })

  router.get('/style.css', (req, res) => {
    try {
      const css = readFileSync(join(publicDir, 'style.css'), 'utf-8')
      res.type('text/css').send(css)
    } catch (error) {
      console.error(error)
      res.status(500).send('Internal Server Error')
    }
  })

  router.get('/client.mjs', (req, res) => {
    try {
      const js = readFileSync(join(publicDir, 'client.mjs'), 'utf-8')
      res.type('text/javascript').send(js)
    } catch (error) {
      console.error(error)
      res.status(500).send('Internal Server Error')
    }
  })
}
