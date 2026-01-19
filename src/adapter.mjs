import Hubot from 'hubot'
import { createChatService } from './server.mjs'

export class HubotChatAdapter extends Hubot.Adapter {
  constructor (robot, options = {}) {
    super(robot)
    this.options = options
    this.chatService = null
  }

  run () {
    const httpServer = getHttpServer(this.robot)
    const router = this.robot.router

    if (!httpServer || !router) {
      console.error('Hubot chat adapter requires Hubot http server')
      return
    }

    this.chatService = createChatService({
      httpServer,
      router,
      options: this.options,
      onUserMessage: (message) => this.receiveFromClient(message)
    })

    this.emit('connected')
  }

  send (envelope, ...strings) {
    this.emitStrings(envelope, strings)
  }

  reply (envelope, ...strings) {
    this.emitStrings(envelope, strings)
  }

  emitStrings (envelope, strings) {
    if (!this.chatService) return
    const roomId = envelope?.room || envelope?.user?.room
    if (!roomId) return
    for (const text of strings) {
      this.chatService.handleHubotSend(roomId, String(text))
    }
  }

  receiveFromClient (message) {
    if (!message) return

    const user = this.robot.brain.userForId(message.sessionId, {
      name: message.nickname,
      room: message.roomId
    })

    user.room = message.roomId

    const hubotMessage = new Hubot.TextMessage(
      user,
      message.text,
      message.messageId
    )

    this.robot.receive(hubotMessage)
  }
}

function getHttpServer (robot) {
  return robot.server || robot.httpd || robot.httpServer || null
}

function getInviteTtlHours () {
  const raw = process.env.HUBOT_CHAT_INVITE_TTL_HOURS
  const parsed = Number.parseInt(raw || '24', 10)
  return Number.isNaN(parsed) ? 24 : parsed
}

export default {
  use (robot) {
    const options = {
      persistPath: process.env.HUBOT_CHAT_PERSIST || null,
      inviteTtlHours: getInviteTtlHours()
    }

    return new HubotChatAdapter(robot, options)
  }
}