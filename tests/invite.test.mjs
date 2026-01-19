import test from 'node:test'
import assert from 'node:assert'
import { InviteManager } from '../src/invite.mjs'

test('Invite: create invite with 24 hour default ttl', async (t) => {
  const manager = new InviteManager()
  const invite = manager.createInvite('room-1', 24)
  
  assert.ok(invite.inviteId)
  assert.ok(invite.token)
  assert.equal(invite.roomId, 'room-1')
  assert.ok(invite.createdAt)
  assert.ok(invite.expiresAt)
})

test('Invite: token hash is set and different from token', async (t) => {
  const manager = new InviteManager()
  const invite = manager.createInvite('room-1', 24)
  
  assert.ok(invite.tokenHash)
  assert.notEqual(invite.token, invite.tokenHash)
})

test('Invite: get invite by token', async (t) => {
  const manager = new InviteManager()
  const created = manager.createInvite('room-1', 24)
  const retrieved = manager.getInviteByToken(created.token)
  
  assert.ok(retrieved)
  assert.equal(retrieved.roomId, 'room-1')
})

test('Invite: consume invite on first use', async (t) => {
  const manager = new InviteManager()
  const invite = manager.createInvite('room-1', 24)
  
  const result = manager.consumeInvite(invite.token)
  assert.ok(result.success)
  assert.equal(result.roomId, 'room-1')
  assert.ok(result.tokenHash)
  
  // Second attempt fails
  const result2 = manager.consumeInvite(invite.token)
  assert.equal(result2.success, false)
})

test('Invite: expired invites cannot be consumed', async (t) => {
  const manager = new InviteManager()
  const invite = manager.createInvite('room-1', -1) // expired
  
  const result = manager.consumeInvite(invite.token)
  assert.equal(result.success, false)
})

test('Invite: invalid token returns error', async (t) => {
  const manager = new InviteManager()
  const result = manager.consumeInvite('invalid-token')
  
  assert.equal(result.success, false)
})

test('Invite: import invite and mark consumed', async (t) => {
  const manager = new InviteManager()
  const now = new Date()
  const invite = {
    inviteId: 'invite-1',
    roomId: 'room-1',
    tokenHash: 'hash-1',
    createdAt: now,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000)
  }

  manager.importInvite(invite)
  manager.markConsumed(invite.tokenHash)

  const result = manager.consumeInvite('invalid-token')
  assert.equal(result.success, false)
})
