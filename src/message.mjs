import { randomUUID } from 'crypto'

export class MessageStore {
  constructor () {
    this.messages = [] // append-only
  }

  addMessage (roomId, sessionId, nickname, text) {
    const message = {
      messageId: randomUUID(),
      roomId,
      sessionId,
      nickname,
      text,
      createdAt: new Date()
    }
    this.messages.push(message)
    return message
  }

  importMessage (message) {
    this.messages.push(message)
  }

  getHistory (roomId) {
    return this.messages.filter(m => m.roomId === roomId)
  }
}
