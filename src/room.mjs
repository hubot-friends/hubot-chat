import { randomUUID } from 'crypto'

export class RoomManager {
  constructor () {
    this.rooms = new Map()
    this.memberships = new Map() // roomId -> [{ sessionId, joinedAt }]
  }

  createRoom (name, visibility, createdBySessionId) {
    const roomId = randomUUID()
    const room = {
      roomId,
      name,
      visibility,
      createdBySessionId,
      createdAt: new Date()
    }
    this.rooms.set(roomId, room)
    this.memberships.set(roomId, [])
    return room
  }

  getRoom (roomId) {
    return this.rooms.get(roomId)
  }

  getRoomByName (name) {
    return Array.from(this.rooms.values()).find(room => room.name === name)
  }

  ensureRoom (name, visibility, createdBySessionId) {
    const existing = this.getRoomByName(name)
    if (existing) return existing
    return this.createRoom(name, visibility, createdBySessionId)
  }

  listPublicRooms () {
    return Array.from(this.rooms.values()).filter(r => r.visibility === 'public')
  }

  getRoomsForSession (sessionId) {
    const rooms = []
    
    for (const [roomId, room] of this.rooms.entries()) {
      const members = this.memberships.get(roomId) || []
      const isMember = members.some(m => m.sessionId === sessionId)
      
      if (room.visibility === 'public' || isMember) {
        rooms.push(room)
      }
    }
    
    return rooms
  }

  addMember (roomId, sessionId, joinedAt = new Date()) {
    if (!this.memberships.has(roomId)) {
      this.memberships.set(roomId, [])
    }
    
    const members = this.memberships.get(roomId)
    
    // Don't add duplicate
    if (!members.some(m => m.sessionId === sessionId)) {
      members.push({
        sessionId,
        joinedAt
      })
    }
  }

  getMembers (roomId) {
    return this.memberships.get(roomId) || []
  }

  isMember (roomId, sessionId) {
    const members = this.memberships.get(roomId) || []
    return members.some(m => m.sessionId === sessionId)
  }
}
