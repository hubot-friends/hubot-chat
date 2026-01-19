import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

export class InviteManager {
  constructor () {
    this.invites = new Map() // tokenHash -> invite object
    this.consumedTokens = new Set()
  }

  createInvite (roomId, ttlHours) {
    const token = randomUUID()
    const tokenHash = this._hashToken(token)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)
    
    const invite = {
      inviteId: randomUUID(),
      roomId,
      token, // sent to user
      tokenHash, // stored securely
      createdAt: now,
      expiresAt
    }
    
    this.invites.set(tokenHash, invite)
    return invite
  }

  importInvite (invite) {
    const stored = {
      inviteId: invite.inviteId,
      roomId: invite.roomId,
      tokenHash: invite.tokenHash,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt
    }
    this.invites.set(invite.tokenHash, stored)
    return stored
  }

  markConsumed (tokenHash) {
    this.consumedTokens.add(tokenHash)
  }

  getInviteByToken (token) {
    const tokenHash = this._hashToken(token)
    return this.invites.get(tokenHash)
  }

  consumeInvite (token) {
    if (!token) {
      return { success: false, error: 'Invalid invite token' }
    }
    const tokenHash = this._hashToken(token)
    const invite = this.invites.get(tokenHash)
    
    if (!invite) {
      return { success: false, error: 'Invalid invite token' }
    }
    
    if (this.consumedTokens.has(tokenHash)) {
      return { success: false, error: 'Invite already used' }
    }
    
    const now = new Date()
    if (now > invite.expiresAt) {
      return { success: false, error: 'Invite expired' }
    }
    
    this.consumedTokens.add(tokenHash)
    return { success: true, roomId: invite.roomId, inviteId: invite.inviteId, tokenHash }
  }

  _hashToken (token) {
    return createHash('sha256').update(token).digest('hex')
  }
}
