import test from 'node:test'
import assert from 'node:assert'
import { createServer } from 'http'
import { WebSocket } from 'ws'
import { createChatService } from '../src/server.mjs'

function createTestServer (options = {}) {
  const httpServer = createServer()
  const router = {
    get: () => {}
  }
  
  const service = createChatService({
    httpServer,
    router,
    options,
    onUserMessage: () => {}
  })
  
  return { httpServer, service }
}

test('Server integration: authentication hook allows connection', async (t) => {
  const { httpServer, service } = createTestServer()
  
  service.hooks.registerAuthHook(async (sessionId, nickname, payload) => {
    return { allowed: true, sessionId, nickname }
  })
  
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = httpServer.address().port
      const ws = new WebSocket(`ws://localhost:${port}`)
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'hello',
          payload: { nickname: 'alice' }
        }))
      })
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data)
        if (msg.type === 'state.init') {
          assert.ok(msg.payload.session)
          assert.equal(msg.payload.session.nickname, 'alice')
          ws.close()
          httpServer.close()
          resolve()
        }
      })
    })
  })
})

test('Server integration: authentication hook denies connection', async (t) => {
  const { httpServer, service } = createTestServer()
  
  service.hooks.registerAuthHook(async (sessionId, nickname, payload) => {
    if (nickname === 'banned') {
      return { allowed: false, reason: 'User is banned' }
    }
    return { allowed: true, sessionId, nickname }
  })
  
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = httpServer.address().port
      const ws = new WebSocket(`ws://localhost:${port}`)
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'hello',
          payload: { nickname: 'banned' }
        }))
      })
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data)
        if (msg.type === 'error') {
          assert.ok(msg.error.includes('banned'))
          ws.close()
          httpServer.close()
          resolve()
        }
      })
    })
  })
})

test('Server integration: authorization hook allows room creation', async (t) => {
  const { httpServer, service } = createTestServer()
  
  service.hooks.registerAuthzHook(async (action, context) => {
    return { allowed: true }
  })
  
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = httpServer.address().port
      const ws = new WebSocket(`ws://localhost:${port}`)
      let sessionId = null
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'hello',
          payload: { nickname: 'alice' }
        }))
      })
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data)
        
        if (msg.type === 'state.init') {
          sessionId = msg.payload.session.sessionId
          ws.send(JSON.stringify({
            type: 'room.create',
            payload: { name: 'test-room', visibility: 'public' }
          }))
        }
        
        if (msg.type === 'room.created') {
          assert.equal(msg.payload.room.name, 'test-room')
          ws.close()
          httpServer.close()
          resolve()
        }
      })
    })
  })
})

test('Server integration: authorization hook denies room creation', async (t) => {
  const { httpServer, service } = createTestServer()
  
  service.hooks.registerAuthzHook(async (action, context) => {
    if (action === 'room.create' && context.roomName === 'forbidden') {
      return { allowed: false, reason: 'Room name is forbidden' }
    }
    return { allowed: true }
  })
  
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = httpServer.address().port
      const ws = new WebSocket(`ws://localhost:${port}`)
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'hello',
          payload: { nickname: 'alice' }
        }))
      })
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data)
        
        if (msg.type === 'state.init') {
          ws.send(JSON.stringify({
            type: 'room.create',
            payload: { name: 'forbidden', visibility: 'public' }
          }))
        }
        
        if (msg.type === 'error') {
          assert.ok(msg.error.includes('forbidden'))
          ws.close()
          httpServer.close()
          resolve()
        }
      })
    })
  })
})

test('Server integration: authorization hook denies message send', async (t) => {
  const { httpServer, service } = createTestServer()
  
  service.hooks.registerAuthzHook(async (action, context) => {
    if (action === 'message.send' && context.text && context.text.includes('spam')) {
      return { allowed: false, reason: 'Message contains spam' }
    }
    return { allowed: true }
  })
  
  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      const port = httpServer.address().port
      const ws = new WebSocket(`ws://localhost:${port}`)
      let roomId = null
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'hello',
          payload: { nickname: 'alice' }
        }))
      })
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data)
        
        if (msg.type === 'state.init') {
          roomId = msg.payload.defaultRoomId
          ws.send(JSON.stringify({
            type: 'message.send',
            payload: { roomId, text: 'This is spam message' }
          }))
        }
        
        if (msg.type === 'error') {
          assert.ok(msg.error.includes('spam'))
          ws.close()
          httpServer.close()
          resolve()
        }
      })
    })
  })
})
