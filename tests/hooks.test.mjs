import test from 'node:test'
import assert from 'node:assert'
import { HookManager } from '../src/hooks.mjs'

// Authentication Hook Tests
test('HookManager: create hook manager', async (t) => {
  const manager = new HookManager()
  assert.ok(manager)
})

test('HookManager: register authentication hook', async (t) => {
  const manager = new HookManager()
  const authHook = async (sessionId, nickname, payload) => {
    return { allowed: true, sessionId, nickname }
  }
  
  manager.registerAuthHook(authHook)
  assert.equal(manager.authHooks.length, 1)
})

test('HookManager: authentication hook allows user', async (t) => {
  const manager = new HookManager()
  const authHook = async (sessionId, nickname, payload) => {
    return { allowed: true, sessionId, nickname }
  }
  
  manager.registerAuthHook(authHook)
  const result = await manager.authenticate('session-1', 'alice', {})
  
  assert.equal(result.allowed, true)
  assert.equal(result.sessionId, 'session-1')
  assert.equal(result.nickname, 'alice')
})

test('HookManager: authentication hook denies user', async (t) => {
  const manager = new HookManager()
  const authHook = async (sessionId, nickname, payload) => {
    if (nickname === 'banned') {
      return { allowed: false, reason: 'User is banned' }
    }
    return { allowed: true, sessionId, nickname }
  }
  
  manager.registerAuthHook(authHook)
  const result = await manager.authenticate(null, 'banned', {})
  
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'User is banned')
})

test('HookManager: authentication hook can modify nickname', async (t) => {
  const manager = new HookManager()
  const authHook = async (sessionId, nickname, payload) => {
    return { allowed: true, sessionId, nickname: nickname.toLowerCase() }
  }
  
  manager.registerAuthHook(authHook)
  const result = await manager.authenticate('session-1', 'ALICE', {})
  
  assert.equal(result.allowed, true)
  assert.equal(result.nickname, 'alice')
})

test('HookManager: multiple authentication hooks run in order', async (t) => {
  const manager = new HookManager()
  const order = []
  
  manager.registerAuthHook(async (sessionId, nickname, payload) => {
    order.push('hook1')
    return { allowed: true, sessionId, nickname }
  })
  
  manager.registerAuthHook(async (sessionId, nickname, payload) => {
    order.push('hook2')
    return { allowed: true, sessionId, nickname: nickname.toUpperCase() }
  })
  
  const result = await manager.authenticate('session-1', 'alice', {})
  
  assert.deepEqual(order, ['hook1', 'hook2'])
  assert.equal(result.nickname, 'ALICE')
})

test('HookManager: authentication stops on first denial', async (t) => {
  const manager = new HookManager()
  const order = []
  
  manager.registerAuthHook(async (sessionId, nickname, payload) => {
    order.push('hook1')
    return { allowed: false, reason: 'First hook denied' }
  })
  
  manager.registerAuthHook(async (sessionId, nickname, payload) => {
    order.push('hook2')
    return { allowed: true, sessionId, nickname }
  })
  
  const result = await manager.authenticate('session-1', 'alice', {})
  
  assert.deepEqual(order, ['hook1'])
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'First hook denied')
})

test('HookManager: no authentication hooks defaults to allowed', async (t) => {
  const manager = new HookManager()
  const result = await manager.authenticate('session-1', 'alice', {})
  
  assert.equal(result.allowed, true)
  assert.equal(result.sessionId, 'session-1')
  assert.equal(result.nickname, 'alice')
})

// Authorization Hook Tests
test('HookManager: register authorization hook', async (t) => {
  const manager = new HookManager()
  const authzHook = async (action, context) => {
    return { allowed: true }
  }
  
  manager.registerAuthzHook(authzHook)
  assert.equal(manager.authzHooks.length, 1)
})

test('HookManager: authorization hook allows action', async (t) => {
  const manager = new HookManager()
  const authzHook = async (action, context) => {
    return { allowed: true }
  }
  
  manager.registerAuthzHook(authzHook)
  const result = await manager.authorize('room.create', { sessionId: 'session-1', roomName: 'general' })
  
  assert.equal(result.allowed, true)
})

test('HookManager: authorization hook denies action', async (t) => {
  const manager = new HookManager()
  const authzHook = async (action, context) => {
    if (action === 'room.create' && context.roomName === 'admin') {
      return { allowed: false, reason: 'Cannot create admin room' }
    }
    return { allowed: true }
  }
  
  manager.registerAuthzHook(authzHook)
  const result = await manager.authorize('room.create', { sessionId: 'session-1', roomName: 'admin' })
  
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'Cannot create admin room')
})

test('HookManager: multiple authorization hooks run in order', async (t) => {
  const manager = new HookManager()
  const order = []
  
  manager.registerAuthzHook(async (action, context) => {
    order.push('hook1')
    return { allowed: true }
  })
  
  manager.registerAuthzHook(async (action, context) => {
    order.push('hook2')
    return { allowed: true }
  })
  
  const result = await manager.authorize('room.create', { sessionId: 'session-1' })
  
  assert.deepEqual(order, ['hook1', 'hook2'])
  assert.equal(result.allowed, true)
})

test('HookManager: authorization stops on first denial', async (t) => {
  const manager = new HookManager()
  const order = []
  
  manager.registerAuthzHook(async (action, context) => {
    order.push('hook1')
    return { allowed: false, reason: 'First hook denied' }
  })
  
  manager.registerAuthzHook(async (action, context) => {
    order.push('hook2')
    return { allowed: true }
  })
  
  const result = await manager.authorize('room.create', { sessionId: 'session-1' })
  
  assert.deepEqual(order, ['hook1'])
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'First hook denied')
})

test('HookManager: no authorization hooks defaults to allowed', async (t) => {
  const manager = new HookManager()
  const result = await manager.authorize('room.create', { sessionId: 'session-1' })
  
  assert.equal(result.allowed, true)
})

test('HookManager: authorization with different actions', async (t) => {
  const manager = new HookManager()
  const actions = []
  
  manager.registerAuthzHook(async (action, context) => {
    actions.push(action)
    return { allowed: true }
  })
  
  await manager.authorize('room.create', { sessionId: 'session-1' })
  await manager.authorize('room.join', { sessionId: 'session-1', roomId: 'room-1' })
  await manager.authorize('message.send', { sessionId: 'session-1', roomId: 'room-1' })
  await manager.authorize('dm.start', { sessionId: 'session-1', targetNickname: 'bob' })
  
  assert.deepEqual(actions, ['room.create', 'room.join', 'message.send', 'dm.start'])
})

test('HookManager: authorization hook can access full context', async (t) => {
  const manager = new HookManager()
  let capturedContext = null
  
  manager.registerAuthzHook(async (action, context) => {
    capturedContext = context
    return { allowed: true }
  })
  
  await manager.authorize('message.send', {
    sessionId: 'session-1',
    roomId: 'room-1',
    text: 'hello world',
    nickname: 'alice'
  })
  
  assert.equal(capturedContext.sessionId, 'session-1')
  assert.equal(capturedContext.roomId, 'room-1')
  assert.equal(capturedContext.text, 'hello world')
  assert.equal(capturedContext.nickname, 'alice')
})
