// Example: Rate Limiting
// This example shows how to implement rate limiting for messages

module.exports = (robot) => {
  const adapter = robot.adapter
  
  if (!adapter.registerAuthzHook) {
    console.log('Authorization hooks not supported by this adapter')
    return
  }
  
  // Track message counts per user
  const messageCounts = new Map()
  
  // Configuration
  const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute
  const MAX_MESSAGES_PER_WINDOW = 20
  const ROOM_CREATE_COOLDOWN_MS = 300000 // 5 minutes
  const lastRoomCreation = new Map()
  
  // Clean up old entries periodically
  setInterval(() => {
    const now = Date.now()
    
    // Clean up message counts
    for (const [key, timestamps] of messageCounts.entries()) {
      const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
      if (recent.length === 0) {
        messageCounts.delete(key)
      } else {
        messageCounts.set(key, recent)
      }
    }
    
    // Clean up room creation timestamps
    for (const [sessionId, timestamp] of lastRoomCreation.entries()) {
      if (now - timestamp > ROOM_CREATE_COOLDOWN_MS) {
        lastRoomCreation.delete(sessionId)
      }
    }
  }, 60000) // Clean up every minute
  
  adapter.registerAuthzHook(async (action, context) => {
    const now = Date.now()
    
    // Rate limit message sending
    if (action === 'message.send') {
      const key = context.sessionId
      
      if (!messageCounts.has(key)) {
        messageCounts.set(key, [])
      }
      
      const timestamps = messageCounts.get(key)
      const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
      
      if (recent.length >= MAX_MESSAGES_PER_WINDOW) {
        return {
          allowed: false,
          reason: `Rate limit exceeded. Maximum ${MAX_MESSAGES_PER_WINDOW} messages per minute. Please slow down.`
        }
      }
      
      recent.push(now)
      messageCounts.set(key, recent)
    }
    
    // Rate limit room creation
    if (action === 'room.create') {
      const lastCreation = lastRoomCreation.get(context.sessionId)
      
      if (lastCreation && now - lastCreation < ROOM_CREATE_COOLDOWN_MS) {
        const remainingMs = ROOM_CREATE_COOLDOWN_MS - (now - lastCreation)
        const remainingMinutes = Math.ceil(remainingMs / 60000)
        
        return {
          allowed: false,
          reason: `Please wait ${remainingMinutes} more minute(s) before creating another room`
        }
      }
      
      lastRoomCreation.set(context.sessionId, now)
    }
    
    return { allowed: true }
  })
  
  console.log('Rate limiting hooks registered')
}
