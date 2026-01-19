import { DatabaseSync } from 'node:sqlite'

export class Persistence {
  constructor (dbPath) {
    this.db = new DatabaseSync(dbPath)
    this.queue = []
    this.isFlushing = false
    this._initializeTables()
  }

  _initializeTables () {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        room_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        visibility TEXT NOT NULL,
        created_by_session_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memberships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        joined_at TEXT NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        message_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invites (
        invite_id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invite_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL,
        event_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
  }

  _enqueue (action) {
    this.queue.push(action)
    if (this.isFlushing) return
    this.isFlushing = true
    setImmediate(() => this._flushQueue())
  }

  _flushQueue () {
    while (this.queue.length > 0) {
      const action = this.queue.shift()
      try {
        action()
      } catch (error) {
        console.error('Persistence error', error)
      }
    }
    this.isFlushing = false
  }

  persistRoom (room) {
    this._enqueue(() => {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO rooms 
        (room_id, name, visibility, created_by_session_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(
        room.roomId,
        room.name,
        room.visibility,
        room.createdBySessionId,
        room.createdAt.toISOString()
      )
    })
  }

  persistMembership (roomId, sessionId, joinedAt) {
    this._enqueue(() => {
      const stmt = this.db.prepare(`
        INSERT INTO memberships (room_id, session_id, joined_at)
        VALUES (?, ?, ?)
      `)
      stmt.run(roomId, sessionId, joinedAt.toISOString())
    })
  }

  persistMessage (message) {
    this._enqueue(() => {
      const stmt = this.db.prepare(`
        INSERT INTO messages 
        (message_id, room_id, session_id, nickname, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        message.messageId,
        message.roomId,
        message.sessionId,
        message.nickname,
        message.text,
        message.createdAt.toISOString()
      )
    })
  }

  persistInvite (invite) {
    this._enqueue(() => {
      const stmt = this.db.prepare(`
        INSERT INTO invites 
        (invite_id, room_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(
        invite.inviteId,
        invite.roomId,
        invite.tokenHash,
        invite.createdAt.toISOString(),
        invite.expiresAt.toISOString()
      )

      const eventStmt = this.db.prepare(`
        INSERT INTO invite_events (token_hash, event_type, created_at)
        VALUES (?, ?, ?)
      `)
      eventStmt.run(invite.tokenHash, 'created', new Date().toISOString())
    })
  }

  recordInviteConsumption (tokenHash) {
    this._enqueue(() => {
      const stmt = this.db.prepare(`
        INSERT INTO invite_events (token_hash, event_type, created_at)
        VALUES (?, ?, ?)
      `)
      stmt.run(tokenHash, 'consumed', new Date().toISOString())
    })
  }

  loadRooms () {
    const stmt = this.db.prepare('SELECT * FROM rooms')
    const rows = stmt.all()
    return rows.map(row => ({
      roomId: row.room_id,
      name: row.name,
      visibility: row.visibility,
      createdBySessionId: row.created_by_session_id,
      createdAt: new Date(row.created_at)
    }))
  }

  loadMemberships () {
    const stmt = this.db.prepare('SELECT * FROM memberships')
    const rows = stmt.all()
    return rows.map(row => ({
      roomId: row.room_id,
      sessionId: row.session_id,
      joinedAt: new Date(row.joined_at)
    }))
  }

  loadMessages () {
    const stmt = this.db.prepare('SELECT * FROM messages ORDER BY created_at ASC')
    const rows = stmt.all()
    return rows.map(row => ({
      messageId: row.message_id,
      roomId: row.room_id,
      sessionId: row.session_id,
      nickname: row.nickname,
      text: row.text,
      createdAt: new Date(row.created_at)
    }))
  }

  loadInvites () {
    const stmt = this.db.prepare('SELECT * FROM invites')
    const rows = stmt.all()
    return rows.map(row => ({
      inviteId: row.invite_id,
      roomId: row.room_id,
      tokenHash: row.token_hash,
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at)
    }))
  }

  loadInviteEvents () {
    const stmt = this.db.prepare('SELECT token_hash, event_type FROM invite_events')
    const rows = stmt.all()
    const created = new Set()
    const consumed = new Set()

    for (const row of rows) {
      if (row.event_type === 'created') created.add(row.token_hash)
      if (row.event_type === 'consumed') consumed.add(row.token_hash)
    }

    return { created, consumed }
  }

  close () {
    this.db.close()
  }
}
