import test from 'node:test'
import assert from 'node:assert'
import { MessageStore } from '../src/message.mjs'

test('Message: send message to room', async (t) => {
  const store = new MessageStore()
  const msg = store.addMessage('room-1', 'session-1', 'alice', 'hello')
  
  assert.ok(msg.messageId)
  assert.equal(msg.roomId, 'room-1')
  assert.equal(msg.sessionId, 'session-1')
  assert.equal(msg.nickname, 'alice')
  assert.equal(msg.text, 'hello')
  assert.ok(msg.createdAt)
})

test('Message: retrieve message history for room', async (t) => {
  const store = new MessageStore()
  store.addMessage('room-1', 'session-1', 'alice', 'hello')
  store.addMessage('room-1', 'session-2', 'bob', 'hi')
  store.addMessage('room-2', 'session-1', 'alice', 'different room')
  
  const history = store.getHistory('room-1')
  
  assert.equal(history.length, 2)
  assert.equal(history[0].nickname, 'alice')
  assert.equal(history[1].nickname, 'bob')
})

test('Message: messages are ordered by createdAt', async (t) => {
  const store = new MessageStore()
  const msg1 = store.addMessage('room-1', 'session-1', 'alice', 'first')
  const msg2 = store.addMessage('room-1', 'session-1', 'alice', 'second')
  
  const history = store.getHistory('room-1')
  
  assert.equal(history[0].messageId, msg1.messageId)
  assert.equal(history[1].messageId, msg2.messageId)
})

test('Message: empty room has no history', async (t) => {
  const store = new MessageStore()
  const history = store.getHistory('room-1')
  
  assert.equal(history.length, 0)
})

test('Message: import message appends to store', async (t) => {
  const store = new MessageStore()
  const message = {
    messageId: 'msg-1',
    roomId: 'room-1',
    sessionId: 'session-1',
    nickname: 'alice',
    text: 'hello',
    createdAt: new Date()
  }

  store.importMessage(message)

  const history = store.getHistory('room-1')
  assert.equal(history.length, 1)
  assert.equal(history[0].messageId, 'msg-1')
})
