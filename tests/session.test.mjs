import test from 'node:test'
import assert from 'node:assert'
import { SessionManager } from '../src/session.mjs'

test('Session: create session with nickname', async (t) => {
  const manager = new SessionManager()
  const session = manager.createSession('alice')
  
  assert.ok(session.sessionId)
  assert.equal(session.nickname, 'alice')
  assert.ok(session.createdAt)
})

test('Session: retrieve session by id', async (t) => {
  const manager = new SessionManager()
  const created = manager.createSession('bob')
  const retrieved = manager.getSession(created.sessionId)
  
  assert.ok(retrieved)
  assert.equal(retrieved.nickname, 'bob')
  assert.equal(retrieved.sessionId, created.sessionId)
})

test('Session: session id is unique', async (t) => {
  const manager = new SessionManager()
  const session1 = manager.createSession('alice')
  const session2 = manager.createSession('bob')
  
  assert.notEqual(session1.sessionId, session2.sessionId)
})

test('Session: restore session by id', async (t) => {
  const manager = new SessionManager()
  const created = manager.createSession('alice', 'session-1')
  const restored = manager.getOrCreateSession('session-1', 'alice')

  assert.equal(restored.sessionId, created.sessionId)
  assert.equal(restored.nickname, 'alice')
})
