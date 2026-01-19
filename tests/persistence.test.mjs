import test from 'node:test'
import assert from 'node:assert'
import { Persistence } from '../src/persistence.mjs'
import { rmSync } from 'fs'
import { existsSync } from 'fs'

const dbPath = '/tmp/test-chat.db'

const waitForQueue = () => new Promise(resolve => setImmediate(resolve))

test('Persistence: create and connect to database', async (t) => {
  // Clean up
  if (existsSync(dbPath)) rmSync(dbPath)
  
  const db = new Persistence(dbPath)
  assert.ok(db)
  db.close()
  assert.ok(existsSync(dbPath))
})

test('Persistence: persist and load room', async (t) => {
  if (existsSync(dbPath)) rmSync(dbPath)
  
  const db = new Persistence(dbPath)
  const room = {
    roomId: 'room-1',
    name: 'test',
    visibility: 'public',
    createdBySessionId: 'session-1',
    createdAt: new Date()
  }
  
  db.persistRoom(room)
  await waitForQueue()

  const loaded = db.loadRooms()
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].roomId, 'room-1')
  assert.equal(loaded[0].name, 'test')
  
  db.close()
})

test('Persistence: persist and load message', async (t) => {
  if (existsSync(dbPath)) rmSync(dbPath)
  
  const db = new Persistence(dbPath)
  const msg = {
    messageId: 'msg-1',
    roomId: 'room-1',
    sessionId: 'session-1',
    nickname: 'alice',
    text: 'hello',
    createdAt: new Date()
  }
  
  db.persistMessage(msg)
  await waitForQueue()
  const loaded = db.loadMessages()
  
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].messageId, 'msg-1')
  assert.equal(loaded[0].text, 'hello')
  
  db.close()
})

test('Persistence: persist and load membership', async (t) => {
  if (existsSync(dbPath)) rmSync(dbPath)
  
  const db = new Persistence(dbPath)
  db.persistMembership('room-1', 'session-1', new Date())
  await waitForQueue()

  const members = db.loadMemberships()
  assert.equal(members.length, 1)
  assert.equal(members[0].sessionId, 'session-1')
  
  db.close()
})

test('Persistence: persist and load invite', async (t) => {
  if (existsSync(dbPath)) rmSync(dbPath)
  
  const db = new Persistence(dbPath)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  
  const invite = {
    inviteId: 'invite-1',
    roomId: 'room-1',
    tokenHash: 'hash-1',
    createdAt: now,
    expiresAt
  }
  
  db.persistInvite(invite)
  await waitForQueue()

  const loaded = db.loadInvites()
  assert.equal(loaded.length, 1)
  assert.equal(loaded[0].roomId, 'room-1')
  
  db.recordInviteConsumption('hash-1')
  await waitForQueue()
  const events = db.loadInviteEvents()
  assert.ok(events.created.has('hash-1'))
  assert.ok(events.consumed.has('hash-1'))
  
  db.close()
})
