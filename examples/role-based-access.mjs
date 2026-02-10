// Example: Role-Based Access Control
// This example shows how to implement role-based authorization

export default (robot) => {
  const adapter = robot.adapter
  
  if (!adapter.registerAuthHook || !adapter.registerAuthzHook) {
    console.log('Authentication/Authorization hooks not supported by this adapter')
    return
  }
  
  // User roles configuration
  // In a real application, you would load this from a database or config file
  const userRoles = new Map([
    ['admin', 'admin'],
    ['moderator', 'moderator'],
    ['alice', 'user'],
    ['bob', 'user']
  ])
  
  // Store roles in session metadata
  const sessionRoles = new Map()
  
  // Assign roles during authentication
  adapter.registerAuthHook(async (sessionId, nickname, payload) => {
    const role = userRoles.get(nickname.toLowerCase()) || 'guest'
    
    // Store role for this session
    sessionRoles.set(sessionId || nickname, role)
    
    return { allowed: true, sessionId, nickname }
  })
  
  // Enforce role-based permissions
  adapter.registerAuthzHook(async (action, context) => {
    const role = sessionRoles.get(context.sessionId) || 'guest'
    
    // Only admins and moderators can create rooms
    if (action === 'room.create') {
      if (role !== 'admin' && role !== 'moderator') {
        return {
          allowed: false,
          reason: 'Only moderators and admins can create rooms'
        }
      }
      
      // Only admins can create private rooms
      if (context.visibility === 'private' && role !== 'admin') {
        return {
          allowed: false,
          reason: 'Only admins can create private rooms'
        }
      }
    }
    
    // Guests cannot join certain rooms
    if (action === 'room.join') {
      const restrictedRooms = ['admin-only', 'staff', 'moderators']
      
      if (restrictedRooms.includes(context.roomName)) {
        if (role === 'guest' || role === 'user') {
          return {
            allowed: false,
            reason: 'You do not have permission to join this room'
          }
        }
      }
    }
    
    // Guests have limited messaging
    if (action === 'message.send') {
      // Guests can only send short messages
      if (role === 'guest' && context.text.length > 100) {
        return {
          allowed: false,
          reason: 'Guest users are limited to 100 characters per message'
        }
      }
    }
    
    // Only admins can DM the hubot user
    if (action === 'dm.start') {
      if (context.targetNickname === 'hubot' && role !== 'admin') {
        return {
          allowed: false,
          reason: 'Only admins can send direct messages to hubot'
        }
      }
    }
    
    return { allowed: true }
  })
  
  // Expose a command to check roles
  robot.respond(/what is my role/i, (res) => {
    const sessionId = res.message.user.id
    const role = sessionRoles.get(sessionId) || 'guest'
    res.reply(`Your role is: ${role}`)
  })
  
  // Expose a command for admins to assign roles
  robot.respond(/set role (\w+) to (\w+)/i, (res) => {
    const sessionId = res.message.user.id
    const currentRole = sessionRoles.get(sessionId) || 'guest'
    
    if (currentRole !== 'admin') {
      res.reply('Only admins can assign roles')
      return
    }
    
    const targetNickname = res.match[1]
    const newRole = res.match[2]
    
    if (!['admin', 'moderator', 'user', 'guest'].includes(newRole)) {
      res.reply('Invalid role. Valid roles are: admin, moderator, user, guest')
      return
    }
    
    userRoles.set(targetNickname.toLowerCase(), newRole)
    res.reply(`Set ${targetNickname}'s role to ${newRole}`)
  })
  
  console.log('Role-based access control hooks registered')
}
