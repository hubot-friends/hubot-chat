# Authentication and Authorization Hook Examples

This directory contains practical examples of how to use authentication and authorization hooks in hubot-chat.

## Available Examples

### 1. basic-auth.mjs
Simple authentication examples including:
- Blocking reserved nicknames
- Normalizing nicknames (lowercase, removing special chars)
- Optional token-based authentication

### 2. content-filter.mjs
Content filtering and moderation including:
- Profanity filtering
- Excessive caps detection
- Message length limits
- Repeated character detection

### 3. rate-limiting.mjs
Rate limiting for abuse prevention including:
- Message rate limiting (max messages per minute)
- Room creation cooldown
- Automatic cleanup of old tracking data

### 4. role-based-access.mjs
Role-based access control including:
- User role assignment during authentication
- Room creation permissions by role
- Room join permissions by role
- Message length limits by role
- DM permissions by role
- Hubot commands for role management

## How to Use

These examples are written as Hubot scripts. To use them:

### Method 1: Copy to your Hubot's scripts directory

```bash
# Copy the example to your Hubot's scripts directory
cp examples/basic-auth.mjs /path/to/your/hubot/scripts/

# Restart your Hubot
npm start
```

### Method 2: Use in your own script

You can also copy the hook registration code into your own Hubot scripts:

```javascript
// In scripts/my-security.mjs
export default (robot) => {
  const adapter = robot.adapter
  
  // Copy hook registration code from examples here
  adapter.registerAuthHook(async (sessionId, nickname, payload) => {
    // Your authentication logic
    return { allowed: true, sessionId, nickname }
  })
  
  adapter.registerAuthzHook(async (action, context) => {
    // Your authorization logic
    return { allowed: true }
  })
}
```

### Method 3: Register hooks at adapter creation

You can also register hooks when creating the adapter:

```javascript
// In your Hubot initialization
const HubotChatAdapter = require('@hubot-friends/hubot-chat')

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

const adapter = new HubotChatAdapter.HubotChatAdapter(robot, {
  authHooks,
  authzHooks
})
```

## Combining Multiple Examples

You can use multiple examples together. Each script registers its own hooks, and they all execute in order:

```bash
# Copy multiple examples to your scripts directory
cp examples/basic-auth.mjs scripts/
cp examples/rate-limiting.mjs scripts/
cp examples/content-filter.mjs scripts/
```

Hooks from all scripts will run in the order the scripts are loaded.

## Customizing Examples

Feel free to modify these examples to fit your needs:

1. **Adjust rate limits**: Change `MAX_MESSAGES_PER_WINDOW` or `RATE_LIMIT_WINDOW_MS`
2. **Add your own profanity list**: Update the `profanityList` array
3. **Define your own roles**: Modify the `userRoles` map
4. **Change permissions**: Adjust the authorization logic for each action

## Testing Your Hooks

After implementing hooks, test them to ensure they work as expected:

1. **Test authentication**: Try connecting with different nicknames
2. **Test authorization**: Try creating rooms, sending messages, etc.
3. **Test edge cases**: Empty strings, special characters, very long messages
4. **Test error messages**: Ensure users see clear error messages when denied

## Security Best Practices

When implementing your own hooks:

1. **Validate all inputs**: Don't trust client-provided data
2. **Use secure token storage**: Store authentication tokens securely
3. **Implement rate limiting**: Prevent abuse
4. **Log denials**: Track authentication and authorization failures
5. **Fail securely**: When in doubt, deny the action
6. **Handle errors gracefully**: Wrap external calls in try/catch

## More Information

For complete documentation, see [HOOKS.md](../HOOKS.md) in the root directory.

For questions or issues:
- Open an issue on GitHub
- Check the tests in `tests/hooks.test.mjs` for more examples
- Review the source code in `src/hooks.mjs`
