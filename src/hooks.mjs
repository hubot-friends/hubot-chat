/**
 * HookManager - Manages authentication and authorization hooks
 * 
 * This class provides a pluggable system for authentication and authorization.
 * External modules can register hooks to control access to the chat system.
 */
export class HookManager {
  constructor () {
    this.authHooks = []
    this.authzHooks = []
  }

  /**
   * Register an authentication hook
   * @param {Function} hook - async (sessionId, nickname, payload) => { allowed, sessionId, nickname, reason }
   */
  registerAuthHook (hook) {
    if (typeof hook !== 'function') {
      throw new Error('Authentication hook must be a function')
    }
    this.authHooks.push(hook)
  }

  /**
   * Register an authorization hook
   * @param {Function} hook - async (action, context) => { allowed, reason }
   */
  registerAuthzHook (hook) {
    if (typeof hook !== 'function') {
      throw new Error('Authorization hook must be a function')
    }
    this.authzHooks.push(hook)
  }

  /**
   * Authenticate a user through all registered authentication hooks
   * @param {string} sessionId - The session ID (may be null for new sessions)
   * @param {string} nickname - The user's nickname
   * @param {object} payload - Additional authentication data
   * @returns {Promise<object>} { allowed, sessionId, nickname, reason }
   */
  async authenticate (sessionId, nickname, payload = {}) {
    // If no hooks registered, allow by default
    if (this.authHooks.length === 0) {
      return {
        allowed: true,
        sessionId,
        nickname
      }
    }

    let currentSessionId = sessionId
    let currentNickname = nickname

    // Run all authentication hooks in order
    for (const hook of this.authHooks) {
      try {
        const result = await hook(currentSessionId, currentNickname, payload)
        
        if (!result || typeof result.allowed !== 'boolean') {
          throw new Error('Authentication hook must return { allowed: boolean }')
        }

        // If denied, stop immediately
        if (!result.allowed) {
          return {
            allowed: false,
            reason: result.reason || 'Authentication denied'
          }
        }

        // Update sessionId and nickname if the hook modified them
        if (result.sessionId !== undefined) {
          currentSessionId = result.sessionId
        }
        if (result.nickname !== undefined) {
          currentNickname = result.nickname
        }
      } catch (error) {
        console.error('Authentication hook error:', error)
        return {
          allowed: false,
          reason: 'Authentication hook error: ' + error.message
        }
      }
    }

    return {
      allowed: true,
      sessionId: currentSessionId,
      nickname: currentNickname
    }
  }

  /**
   * Authorize an action through all registered authorization hooks
   * @param {string} action - The action being performed (e.g., 'room.create', 'message.send')
   * @param {object} context - Context information about the action
   * @returns {Promise<object>} { allowed, reason }
   */
  async authorize (action, context = {}) {
    // If no hooks registered, allow by default
    if (this.authzHooks.length === 0) {
      return {
        allowed: true
      }
    }

    // Run all authorization hooks in order
    for (const hook of this.authzHooks) {
      try {
        const result = await hook(action, context)
        
        if (!result || typeof result.allowed !== 'boolean') {
          throw new Error('Authorization hook must return { allowed: boolean }')
        }

        // If denied, stop immediately
        if (!result.allowed) {
          return {
            allowed: false,
            reason: result.reason || 'Authorization denied'
          }
        }
      } catch (error) {
        console.error('Authorization hook error:', error)
        return {
          allowed: false,
          reason: 'Authorization hook error: ' + error.message
        }
      }
    }

    return {
      allowed: true
    }
  }
}
