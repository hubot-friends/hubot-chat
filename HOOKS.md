# Authentication and Authorization Hooks

This document describes how to use authentication and authorization hooks to extend hubot-chat with custom security logic.

## Overview

The hooks system provides a pluggable architecture for:
- **Authentication**: Control who can connect and use the chat system
- **Authorization**: Control what actions authenticated users can perform

Hooks are functions that run before actions are executed. They can:
- Allow or deny the action
- Modify request data (e.g., normalize nicknames)
- Add custom business logic

## Authentication Hooks

Authentication hooks are called when a user attempts to connect to the chat system via the `hello` message.

### Hook Signature

```javascript
async (sessionId, nickname, payload) => {
  return {
    allowed: boolean,
    sessionId: string,    // Optional: can modify session ID
    nickname: string,     // Optional: can modify nickname
    reason: string        // Required if allowed=false
  }
}
```

### Parameters

- `sessionId` - The session ID from the client (may be null for new connections)
- `nickname` - The requested nickname
- `payload` - The full payload from the hello message (may contain additional auth data)

### Return Value

The hook must return an object with:
- `allowed` (boolean) - Whether to allow the connection
- `sessionId` (string, optional) - Modified session ID
- `nickname` (string, optional) - Modified nickname
- `reason` (string) - Why authentication was denied (required if `allowed` is false)

### Example: Basic Authentication

```javascript
// Block specific nicknames
adapter.registerAuthHook(async (sessionId, nickname, payload) => {
  const bannedNicknames = ['admin', 'root', 'system']
  if (bannedNicknames.includes(nickname.toLowerCase())) {
    return {
      allowed: false,
      reason: 'This nickname is reserved'
    }
  }
  return { allowed: true, sessionId, nickname }
})
```

### Example: Token-Based Authentication

```javascript
// Require authentication token in payload
adapter.registerAuthHook(async (sessionId, nickname, payload) => {
  const token = payload.authToken
  
  if (!token) {
    return {
      allowed: false,
      reason: 'Authentication token required'
    }
  }
  
  // Verify token (example using JWT)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return {
      allowed: true,
      sessionId: decoded.userId,
      nickname: decoded.username
    }
  } catch (error) {
    return {
      allowed: false,
      reason: 'Invalid authentication token'
    }
  }
})
```

### Example: Nickname Normalization

```javascript
// Force nicknames to lowercase and remove special characters
adapter.registerAuthHook(async (sessionId, nickname, payload) => {
  const normalizedNickname = nickname
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
  
  return {
    allowed: true,
    sessionId,
    nickname: normalizedNickname
  }
})
```

## Authorization Hooks

Authorization hooks are called before actions are performed. They control what authenticated users can do.

### Hook Signature

```javascript
async (action, context) => {
  return {
    allowed: boolean,
    reason: string  // Required if allowed=false
  }
}
```

### Parameters

- `action` (string) - The action being performed: `'room.create'`, `'room.join'`, `'message.send'`, `'dm.start'`
- `context` (object) - Context information about the action (varies by action type)

### Context by Action Type

#### `room.create`
```javascript
{
  sessionId: string,
  nickname: string,
  roomName: string,
  visibility: 'public' | 'private'
}
```

#### `room.join`
```javascript
{
  sessionId: string,
  nickname: string,
  roomId: string,
  roomName: string,
  visibility: 'public' | 'private'
}
```

#### `message.send`
```javascript
{
  sessionId: string,
  nickname: string,
  roomId: string,
  roomName: string,
  text: string
}
```

#### `dm.start`
```javascript
{
  sessionId: string,
  nickname: string,
  targetNickname: string,
  targetSessionId: string
}
```

### Return Value

The hook must return an object with:
- `allowed` (boolean) - Whether to allow the action
- `reason` (string) - Why authorization was denied (required if `allowed` is false)

### Example: Room Creation Restrictions

```javascript
// Only allow specific users to create rooms
adapter.registerAuthzHook(async (action, context) => {
  if (action === 'room.create') {
    const allowedCreators = ['admin', 'moderator']
    if (!allowedCreators.includes(context.nickname)) {
      return {
        allowed: false,
        reason: 'Only moderators can create rooms'
      }
    }
  }
  return { allowed: true }
})
```

### Example: Content Filtering

```javascript
// Block messages containing profanity
adapter.registerAuthzHook(async (action, context) => {
  if (action === 'message.send') {
    const profanityList = ['badword1', 'badword2']
    const hasProfanity = profanityList.some(word => 
      context.text.toLowerCase().includes(word)
    )
    
    if (hasProfanity) {
      return {
        allowed: false,
        reason: 'Message contains inappropriate content'
      }
    }
  }
  return { allowed: true }
})
```

### Example: Rate Limiting

```javascript
// Rate limit message sending
const messageCounts = new Map()

adapter.registerAuthzHook(async (action, context) => {
  if (action === 'message.send') {
    const key = context.sessionId
    const now = Date.now()
    const windowMs = 60000 // 1 minute
    const maxMessages = 10
    
    if (!messageCounts.has(key)) {
      messageCounts.set(key, [])
    }
    
    const timestamps = messageCounts.get(key)
    const recent = timestamps.filter(t => now - t < windowMs)
    
    if (recent.length >= maxMessages) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded. Please slow down.'
      }
    }
    
    recent.push(now)
    messageCounts.set(key, recent)
  }
  return { allowed: true }
})
```

### Example: Private Room Restrictions

```javascript
// Prevent users from joining specific private rooms
adapter.registerAuthzHook(async (action, context) => {
  if (action === 'room.join') {
    const restrictedRooms = ['admin-only', 'staff']
    const allowedUsers = ['admin', 'moderator']
    
    if (restrictedRooms.includes(context.roomName)) {
      if (!allowedUsers.includes(context.nickname)) {
        return {
          allowed: false,
          reason: 'You do not have permission to join this room'
        }
      }
    }
  }
  return { allowed: true }
})
```

### Example: DM Restrictions

```javascript
// Prevent users from starting DMs with specific users
adapter.registerAuthzHook(async (action, context) => {
  if (action === 'dm.start') {
    const protectedUsers = ['hubot', 'system']
    
    if (protectedUsers.includes(context.targetNickname)) {
      return {
        allowed: false,
        reason: 'Cannot start DM with system users'
      }
    }
  }
  return { allowed: true }
})
```

## Hook Execution Order

### Multiple Hooks

You can register multiple hooks of the same type. They execute in registration order.

```javascript
adapter.registerAuthHook(hook1)  // Runs first
adapter.registerAuthHook(hook2)  // Runs second
adapter.registerAuthHook(hook3)  // Runs third
```

### Early Termination

If any hook denies an action, execution stops immediately. Subsequent hooks are not called.

```javascript
adapter.registerAuthHook(async (sessionId, nickname) => {
  if (nickname === 'banned') {
    return { allowed: false, reason: 'User is banned' }
    // hook2 and hook3 will not run
  }
  return { allowed: true, sessionId, nickname }
})

adapter.registerAuthHook(hook2)  // Won't run if hook1 denies
adapter.registerAuthHook(hook3)  // Won't run if hook1 or hook2 denies
```

### Data Flow

For authentication hooks, each hook can modify the sessionId and nickname. These modifications are passed to the next hook:

```javascript
adapter.registerAuthHook(async (sessionId, nickname) => {
  // First hook: normalize nickname
  return {
    allowed: true,
    sessionId,
    nickname: nickname.toLowerCase()
  }
})

adapter.registerAuthHook(async (sessionId, nickname) => {
  // Second hook receives the lowercased nickname
  console.log(nickname)  // Already lowercase from first hook
  return { allowed: true, sessionId, nickname }
})
```

## Integration with Hubot

### Method 1: Via Adapter Options

Pass hooks when creating the adapter:

```javascript
// In your Hubot script or initialization
const authHooks = [
  async (sessionId, nickname, payload) => {
    // Your auth logic
    return { allowed: true, sessionId, nickname }
  }
]

const authzHooks = [
  async (action, context) => {
    // Your authz logic
    return { allowed: true }
  }
]

const adapter = new HubotChatAdapter(robot, {
  authHooks,
  authzHooks,
  persistPath: process.env.HUBOT_CHAT_PERSIST,
  inviteTtlHours: 24
})
```

### Method 2: Register After Adapter Creation

Register hooks on the adapter instance:

```javascript
const adapter = new HubotChatAdapter(robot, options)

adapter.registerAuthHook(async (sessionId, nickname, payload) => {
  // Your auth logic
  return { allowed: true, sessionId, nickname }
})

adapter.registerAuthzHook(async (action, context) => {
  // Your authz logic
  return { allowed: true }
})
```

### Method 3: Via Hubot Script

Create a Hubot script that registers hooks:

```javascript
// scripts/security.js
module.exports = (robot) => {
  const adapter = robot.adapter
  
  if (adapter.registerAuthHook) {
    adapter.registerAuthHook(async (sessionId, nickname, payload) => {
      // Your authentication logic
      return { allowed: true, sessionId, nickname }
    })
  }
  
  if (adapter.registerAuthzHook) {
    adapter.registerAuthzHook(async (action, context) => {
      // Your authorization logic
      return { allowed: true }
    })
  }
}
```

## Default Behavior

If no hooks are registered:
- All authentication attempts are **allowed** by default
- All authorization checks are **allowed** by default

This maintains backward compatibility with existing deployments.

## Error Handling

If a hook throws an error:
- The error is logged to console
- The action is **denied** by default
- An error message is sent to the client

```javascript
adapter.registerAuthHook(async (sessionId, nickname) => {
  // If this throws an error
  throw new Error('Database connection failed')
  // The user will see: "Authentication hook error: Database connection failed"
})
```

## Testing Hooks

Example test for an authentication hook:

```javascript
import test from 'node:test'
import assert from 'node:assert'
import { HookManager } from './src/hooks.mjs'

test('Authentication hook blocks banned users', async (t) => {
  const manager = new HookManager()
  
  manager.registerAuthHook(async (sessionId, nickname) => {
    if (nickname === 'banned') {
      return { allowed: false, reason: 'User is banned' }
    }
    return { allowed: true, sessionId, nickname }
  })
  
  const result = await manager.authenticate(null, 'banned', {})
  
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'User is banned')
})
```

## Best Practices

1. **Keep hooks lightweight**: Hooks run on every action, so avoid expensive operations
2. **Use async/await**: Hooks support async operations for database queries, API calls, etc.
3. **Provide clear error messages**: Users need to understand why their action was denied
4. **Log denials**: Consider logging denied actions for security auditing
5. **Test thoroughly**: Write tests for your hooks to ensure they work correctly
6. **Consider performance**: Multiple hooks run sequentially, so minimize execution time
7. **Handle errors gracefully**: Wrap external calls in try/catch to prevent crashes

## Security Considerations

1. **Validate all inputs**: Don't trust client-provided data
2. **Use secure token storage**: Store authentication tokens securely
3. **Implement rate limiting**: Prevent abuse through authorization hooks
4. **Audit logging**: Log authentication and authorization decisions
5. **Fail securely**: When in doubt, deny the action
6. **Session management**: Implement proper session timeout and renewal
7. **Input sanitization**: Sanitize user inputs to prevent injection attacks

## Examples Repository

For complete working examples, see the `examples/` directory in the repository:
- `examples/basic-auth.js` - Simple authentication hook
- `examples/rate-limiting.js` - Message rate limiting
- `examples/content-filter.js` - Content filtering hook
- `examples/role-based-access.js` - Role-based authorization

## Support

For questions or issues with the hooks system:
- Open an issue on GitHub
- Check the tests in `tests/hooks.test.mjs` for more examples
- Review the source code in `src/hooks.mjs`
