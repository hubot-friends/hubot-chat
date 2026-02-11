import adapter from './adapter.mjs'

export { createChatService } from './server.mjs'
export { SessionManager } from './session.mjs'
export { RoomManager } from './room.mjs'
export { MessageStore } from './message.mjs'
export { InviteManager } from './invite.mjs'
export { Persistence } from './persistence.mjs'
export { HubotChatAdapter } from './adapter.mjs'
export { UIProvider, NullUIProvider } from './ui-provider.mjs'
export { DefaultUIProvider } from './default-ui-provider.mjs'
export { AuthUIProvider, CustomUIProvider } from './auth-ui-provider.mjs'

export default {
	use (robot) {
		return adapter.use(robot)
	}
}
