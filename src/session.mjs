import { randomUUID } from 'crypto'

export class SessionManager {
  constructor () {
    this.sessions = new Map()
  }

  createSession (nickname, sessionId = null) {
    const id = sessionId || randomUUID()
    const session = {
      sessionId: id,
      nickname,
      createdAt: new Date()
    }
    this.sessions.set(id, session)
    return session
  }

  getOrCreateSession (sessionId, nickname) {
    if (sessionId && this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId)
      if (nickname) session.nickname = nickname
      return session
    }

    return this.createSession(nickname, sessionId)
  }

  getSession (sessionId) {
    return this.sessions.get(sessionId)
  }

  findSessionByNickname (nickname) {
    if (!nickname) return null
    const lower = nickname.toLowerCase()
    for (const session of this.sessions.values()) {
      if (session.nickname?.toLowerCase() === lower) return session
    }
    return null
  }

  listSessions () {
    return Array.from(this.sessions.values())
  }
}
