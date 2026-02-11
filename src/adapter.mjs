import { Adapter, TextMessage } from 'hubot'
import { createChatService } from './server.mjs'
import { DefaultUIProvider } from './default-ui-provider.mjs'
import { AuthUIProvider, CustomUIProvider } from './auth-ui-provider.mjs'

export class HubotChatAdapter extends Adapter {
  constructor (robot, options = {}) {
    super(robot)
    this.options = options
    this.chatService = null
  }

  async run () {
    const httpServer = getHttpServer(this.robot)
    const router = this.robot.router

    if (!httpServer || !router) {
      console.error('Hubot chat adapter requires Hubot http server')
      return
    }

    // Create appropriate UI provider based on options
    const uiProvider = this.createUIProvider()

    // If auth config is provided with a handler, register it as an auth hook
    if (this.options.auth?.handler) {
      this.registerAuthHook(async (sessionId, nickname, payload) => {
        return await this.options.auth.handler(payload, sessionId, nickname)
      })
    }

    this.chatService = await createChatService({
      httpServer,
      router,
      options: this.options,
      onUserMessage: (message) => this.receiveFromClient(message),
      uiProvider
    })

    // Register authentication and authorization hooks if provided
    if (this.options.authHooks) {
      for (const hook of this.options.authHooks) {
        this.chatService.hooks.registerAuthHook(hook)
      }
    }

    if (this.options.authzHooks) {
      for (const hook of this.options.authzHooks) {
        this.chatService.hooks.registerAuthzHook(hook)
      }
    }

    this.emit('connected')
  }

  /**
   * Create the appropriate UI provider based on options
   * @private
   */
  createUIProvider () {
    // Tier 3: Explicit UI provider (custom or null for headless)
    if (this.options.uiProvider !== undefined) {
      return this.options.uiProvider
    }

    // Tier 3: Custom HTML path
    if (this.options.customHtml) {
      return new CustomUIProvider(this.options.customHtml)
    }

    // Tier 2: Auth configuration provided
    if (this.options.auth) {
      return new AuthUIProvider(this.options.auth)
    }

    // Tier 1: Default (nickname-based auth)
    return new DefaultUIProvider()
  }

  /**
   * Register an authentication hook
   * @param {Function} hook - async (sessionId, nickname, payload) => { allowed, sessionId, nickname, reason }
   */
  registerAuthHook (hook) {
    if (this.chatService) {
      this.chatService.hooks.registerAuthHook(hook)
    } else {
      if (!this.options.authHooks) {
        this.options.authHooks = []
      }
      this.options.authHooks.push(hook)
    }
  }

  /**
   * Register an authorization hook
   * @param {Function} hook - async (action, context) => { allowed, reason }
   */
  registerAuthzHook (hook) {
    if (this.chatService) {
      this.chatService.hooks.registerAuthzHook(hook)
    } else {
      if (!this.options.authzHooks) {
        this.options.authzHooks = []
      }
      this.options.authzHooks.push(hook)
    }
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

    const hubotMessage = new TextMessage(
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

function getBasePath () {
  return process.env.HUBOT_CHAT_BASE_PATH || ''
}

export default {
  use (robot) {
    const options = {
      persistPath: process.env.HUBOT_CHAT_PERSIST || null,
      inviteTtlHours: getInviteTtlHours(),
      basePath: getBasePath()
    }

    return new HubotChatAdapter(robot, options)
  }
}