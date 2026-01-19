import test from 'node:test'
import assert from 'node:assert'
import { RoomManager } from '../src/room.mjs'

test('Room: create public room', async (t) => {
  const manager = new RoomManager()
  const room = manager.createRoom('general', 'public', 'session-1')
  
  assert.ok(room.roomId)
  assert.equal(room.name, 'general')
  assert.equal(room.visibility, 'public')
  assert.equal(room.createdBySessionId, 'session-1')
  assert.ok(room.createdAt)
})

test('Room: create private room', async (t) => {
  const manager = new RoomManager()
  const room = manager.createRoom('secret', 'private', 'session-1')
  
  assert.equal(room.visibility, 'private')
})

test('Room: retrieve room by id', async (t) => {
  const manager = new RoomManager()
  const created = manager.createRoom('test', 'public', 'session-1')
  const retrieved = manager.getRoom(created.roomId)
  
  assert.ok(retrieved)
  assert.equal(retrieved.name, 'test')
})

test('Room: retrieve room by name', async (t) => {
  const manager = new RoomManager()
  manager.createRoom('general', 'public', 'session-1')
  const retrieved = manager.getRoomByName('general')

  assert.ok(retrieved)
  assert.equal(retrieved.visibility, 'public')
})

test('Room: ensure room returns existing', async (t) => {
  const manager = new RoomManager()
  const first = manager.ensureRoom('general', 'public', 'session-1')
  const second = manager.ensureRoom('general', 'public', 'session-2')

  assert.equal(first.roomId, second.roomId)
  assert.equal(second.createdBySessionId, 'session-1')
})

test('Room: list all public rooms', async (t) => {
  const manager = new RoomManager()
  manager.createRoom('general', 'public', 'session-1')
  manager.createRoom('random', 'public', 'session-1')
  manager.createRoom('private', 'private', 'session-1')
  
  const publicRooms = manager.listPublicRooms()
  
  assert.equal(publicRooms.length, 2)
  assert.ok(publicRooms.every(r => r.visibility === 'public'))
})

test('Room: get rooms for session (public + own private)', async (t) => {
  const manager = new RoomManager()
  const pubRoom = manager.createRoom('general', 'public', 'session-1')
  const privRoom1 = manager.createRoom('group-a', 'private', 'session-1')
  const privRoom2 = manager.createRoom('group-b', 'private', 'session-2')
  
  manager.addMember(pubRoom.roomId, 'session-1')
  manager.addMember(privRoom1.roomId, 'session-1')
  manager.addMember(privRoom2.roomId, 'session-2')
  
  const sessionRooms = manager.getRoomsForSession('session-1')
  
  assert.equal(sessionRooms.length, 2)
  assert.ok(sessionRooms.find(r => r.roomId === pubRoom.roomId))
  assert.ok(sessionRooms.find(r => r.roomId === privRoom1.roomId))
})

test('Room: add member to room', async (t) => {
  const manager = new RoomManager()
  const room = manager.createRoom('test', 'public', 'session-1')
  
  manager.addMember(room.roomId, 'session-1')
  manager.addMember(room.roomId, 'session-2')
  
  const members = manager.getMembers(room.roomId)
  assert.equal(members.length, 2)
})

test('Room: members include joinedAt timestamp', async (t) => {
  const manager = new RoomManager()
  const room = manager.createRoom('test', 'public', 'session-1')
  
  manager.addMember(room.roomId, 'session-1')
  const members = manager.getMembers(room.roomId)
  
  assert.ok(members[0].joinedAt)
  assert.equal(members[0].sessionId, 'session-1')
})
