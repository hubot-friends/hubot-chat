// Example: Basic Authentication Hook
// This example shows how to add simple authentication to hubot-chat

// In your Hubot script (e.g., scripts/auth.js)
module.exports = (robot) => {
  const adapter = robot.adapter
  
  // Only register hooks if the adapter supports them
  if (!adapter.registerAuthHook || !adapter.registerAuthzHook) {
    console.log('Authentication hooks not supported by this adapter')
    return
  }
  
  // Example 1: Block specific nicknames
  adapter.registerAuthHook(async (sessionId, nickname, payload) => {
    const bannedNicknames = ['admin', 'root', 'system', 'hubot']
    
    if (bannedNicknames.includes(nickname.toLowerCase())) {
      return {
        allowed: false,
        reason: 'This nickname is reserved'
      }
    }
    
    return { allowed: true, sessionId, nickname }
  })
  
  // Example 2: Normalize nicknames
  adapter.registerAuthHook(async (sessionId, nickname, payload) => {
    // Force nicknames to lowercase and remove special characters
    const normalizedNickname = nickname
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
    
    // Ensure nickname is not empty after normalization
    if (!normalizedNickname) {
      return {
        allowed: false,
        reason: 'Invalid nickname format'
      }
    }
    
    return {
      allowed: true,
      sessionId,
      nickname: normalizedNickname
    }
  })
  
  // Example 3: Require authentication token (optional)
  // Uncomment if you want to require tokens
  /*
  adapter.registerAuthHook(async (sessionId, nickname, payload) => {
    const requiredToken = process.env.HUBOT_CHAT_AUTH_TOKEN
    
    if (requiredToken && payload.authToken !== requiredToken) {
      return {
        allowed: false,
        reason: 'Invalid authentication token'
      }
    }
    
    return { allowed: true, sessionId, nickname }
  })
  */
  
  console.log('Authentication hooks registered')
}
