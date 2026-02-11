// Examples of using hubot-chat with different UI customization levels

// =============================================================================
// Tier 1: Default Experience (Zero Config)
// =============================================================================
// The simplest setup - uses built-in nickname authentication UI
import Hubot from 'hubot'
import { HubotChatAdapter } from '@hubot-friends/hubot-chat'

const robot = new Hubot.Robot(null, null, false, 'mybot')
const adapter = new HubotChatAdapter(robot)
robot.adapter = adapter
robot.run()

// =============================================================================
// Tier 2: Auth Configuration with Auto-UI
// =============================================================================
// Declare auth requirements - UI adapts automatically
import { HubotChatAdapter } from '@hubot-friends/hubot-chat'
import { scrypt, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('./users.db')

const adapter = new HubotChatAdapter(robot, {
  auth: {
    type: 'login',
    fields: ['username', 'password'],
    labels: {
      username: 'Email',
      password: 'Password'
    },
    hints: {
      username: 'Enter your company email'
    },
    handler: async (credentials) => {
      // Your SQL auth logic using native SQLite
      const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
      const user = stmt.get(credentials.username)
      
      if (!user) {
        return { allowed: false, reason: 'Invalid credentials' }
      }
      
      // Verify password using native crypto (scrypt)
      // Password hash format: salt:hash (both hex-encoded)
      // To create: scrypt(password, randomBytes(16), 64, (err, key) => `${salt.toString('hex')}:${key.toString('hex')}`)
      const [salt, hash] = user.password_hash.split(':')
      const keyBuffer = await new Promise((resolve, reject) => {
        scrypt(credentials.password, salt, 64, (err, derivedKey) => {
          if (err) reject(err)
          else resolve(derivedKey)
        })
      })
      
      const hashBuffer = Buffer.from(hash, 'hex')
      const match = timingSafeEqual(keyBuffer, hashBuffer)
      
      if (!match) {
        return { allowed: false, reason: 'Invalid credentials' }
      }
      
      return { 
        allowed: true, 
        sessionId: user.id, 
        nickname: user.display_name 
      }
    }
  }
})

// =============================================================================
// Tier 2b: Token-Based Authentication (Session Token)
// =============================================================================
// Using native crypto for token generation and validation
import { randomBytes, createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const tokenDb = new DatabaseSync('./tokens.db')

const adapter = new HubotChatAdapter(robot, {
  auth: {
    type: 'token',  // Client reads token from URL or localStorage
    handler: async (credentials) => {
      if (!credentials.token) {
        return { allowed: false, reason: 'Token required' }
      }
      
      // Hash the token before lookup (store hashed tokens in DB for security)
      const tokenHash = createHash('sha256').update(credentials.token).digest('hex')
      const stmt = tokenDb.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
      const session = stmt.get(tokenHash, Date.now())
      
      if (!session) {
        return { allowed: false, reason: 'Invalid or expired token' }
      }
      
      return {
        allowed: true,
        sessionId: session.user_id,
        nickname: session.username
      }
    }
  }
})

// To generate a token (in your login endpoint):
// const token = randomBytes(32).toString('hex')
// const tokenHash = createHash('sha256').update(token).digest('hex')
// db.prepare('INSERT INTO sessions (token_hash, user_id, username, expires_at) VALUES (?, ?, ?, ?)').run(...)
// return token to client

// =============================================================================
// Tier 2c: SSO Authentication
// =============================================================================
const adapter = new HubotChatAdapter(robot, {
  auth: {
    type: 'sso',
    fields: ['provider'],
    handler: async (credentials) => {
      // After OAuth callback, you'd have a token
      const userInfo = await validateSSOToken(credentials.ssoToken)
      return {
        allowed: true,
        sessionId: userInfo.id,
        nickname: userInfo.name
      }
    }
  }
})

// =============================================================================
// Tier 3a: Custom UI Provider (Custom Directory)
// =============================================================================
import { CustomUIProvider } from '@hubot-friends/hubot-chat'

const adapter = new HubotChatAdapter(robot, {
  uiProvider: new CustomUIProvider('./my-custom-ui')
})
// Serves files from ./my-custom-ui/index.html, client.mjs, style.css

// =============================================================================
// Tier 3b: Programmatic UI Provider
// =============================================================================
import { UIProvider } from '@hubot-friends/hubot-chat'
import { readFile } from 'fs/promises'

class MyReactUIProvider extends UIProvider {
  async getIndexHtml(context) {
    return `
      <!DOCTYPE html>
      <html>
        <head><title>My Chat</title></head>
        <body>
          <div id="root"></div>
          <script src="${context.basePath}/bundle.js"></script>
        </body>
      </html>
    `
  }
  
  async getClientScript(context) {
    // Return your bundled React app
    return await readFile('./dist/bundle.js', 'utf-8')
  }
  
  async getStylesheet(context) {
    return await readFile('./dist/styles.css', 'utf-8')
  }
}

const adapter = new HubotChatAdapter(robot, {
  uiProvider: new MyReactUIProvider()
})

// =============================================================================
// Tier 3c: Headless Mode (No UI, API Only)
// =============================================================================
import { NullUIProvider } from '@hubot-friends/hubot-chat'

const adapter = new HubotChatAdapter(robot, {
  uiProvider: null  // or new NullUIProvider()
})
// No HTTP routes registered - your app provides its own UI
// Uses only the WebSocket protocol

// =============================================================================
// Advanced: Combining Auth Hooks with Custom UI
// =============================================================================
const adapter = new HubotChatAdapter(robot, {
  uiProvider: new CustomUIProvider('./my-ui'),
  auth: {
    handler: async (credentials) => {
      // Custom auth logic
      return await validateUser(credentials)
    }
  }
})

// Or use the hook API directly for more control
adapter.registerAuthHook(async (sessionId, nickname, payload) => {
  // Custom authentication logic
  return { allowed: true, sessionId, nickname }
})

adapter.registerAuthzHook(async (action, context) => {
  // Custom authorization logic
  if (action === 'room.create' && !context.nickname.startsWith('admin-')) {
    return { allowed: false, reason: 'Only admins can create rooms' }
  }
  return { allowed: true }
})
