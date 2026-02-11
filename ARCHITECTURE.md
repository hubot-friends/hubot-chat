# Architecture: Clean Separation of Concerns

This document describes the architectural refactoring that provides clean boundaries and progressive customization.

## Design Principles

1. **Single Responsibility**: Each module has one reason to change
2. **Dependency Inversion**: High-level policy doesn't depend on low-level details
3. **Interface Segregation**: Clients depend only on interfaces they use
4. **Progressive Enhancement**: Simple by default, powerful when needed

## Layer Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Adapter (Integration)                   │
│  Wires components together, provides configuration API      │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   HTTP Server    │ │  Chat Protocol   │ │   UI Provider    │
│  (Asset Serving) │ │   (WebSocket)    │ │   (Interface)    │
└──────────────────┘ └──────────────────┘ └──────────────────┘
          │                   │                   │
          │                   ▼                   ▼
          │         ┌──────────────────┐ ┌──────────────────┐
          │         │   Domain Logic   │ │  Implementations │
          │         │ (Sessions, Rooms)│ │ Default/Auth/... │
          │         └──────────────────┘ └──────────────────┘
          │                   │
          │                   ▼
          │         ┌──────────────────┐
          └────────▶│   Persistence    │
                    │   (Cross-cutting)│
                    └──────────────────┘
```

## Module Responsibilities

### 1. Domain Layer (Pure Business Logic)

**Files**: `session.mjs`, `room.mjs`, `message.mjs`, `invite.mjs`

- No dependencies on HTTP, WebSocket, or UI
- Pure data structures and business rules
- Testable in isolation
- No side effects (except through returned values)

### 2. Protocol Layer (WebSocket)

**File**: `server.mjs` (formerly handled both HTTP and WebSocket)

**Responsibilities**:
- WebSocket connection management
- Message routing and handling
- Delegates to domain objects
- Invokes authentication/authorization hooks
- Broadcasting to connected clients

**Dependencies**: Domain layer, HookManager, Persistence
**Knows nothing about**: HTTP routes, HTML, CSS, JavaScript serving

### 3. HTTP/Asset Layer

**File**: `http-server.mjs` (extracted from server.mjs)

**Responsibilities**:
- Registers HTTP routes on provided router
- Delegates asset serving to UIProvider
- Error handling for asset requests

**Dependencies**: UIProvider interface
**Knows nothing about**: WebSocket, authentication logic, domain entities

### 4. UI Provider Interface

**File**: `ui-provider.mjs`

**Contract**:
```javascript
interface UIProvider {
  getIndexHtml(context): Promise<string>
  getStylesheet(context): Promise<string>
  getClientScript(context): Promise<string>
  getAsset(path, context): Promise<{content, contentType}>
}
```

**Implementations**:
- `DefaultUIProvider` - Built-in nickname auth UI
- `AuthUIProvider` - Extends default with auth config injection
- `CustomUIProvider` - Serves files from custom directory
- `NullUIProvider` - Headless mode (no UI)

### 5. Integration Layer

**File**: `adapter.mjs`

**Responsibilities**:
- Dependency injection point
- Creates appropriate UIProvider based on options
- Bridges auth config to auth hooks
- Wires HTTP server, protocol handler, and UI provider together
- Provides public API for consuming applications

## Clean Boundaries

### Boundary 1: Protocol ↔ HTTP

**Before**: `server.mjs` mixed WebSocket and HTTP concerns

**After**: 
- `server.mjs` - Pure WebSocket protocol handling
- `http-server.mjs` - Pure HTTP asset serving
- Communication via: UIProvider interface

**Benefit**: Can run headless, swap UI without touching protocol

### Boundary 2: Business Logic ↔ Infrastructure

**Maintained**: Domain objects remain pure, infrastructure wraps them

**Benefit**: Domain logic testable without mocks, zero coupling to Node.js APIs

### Boundary 3: Default ↔ Custom UI

**Before**: Public files hardcoded, loaded directly

**After**: UIProvider abstraction allows:
- Default implementation (backward compatible)
- Auth-aware variant (auto-adapts to config)
- Completely custom implementations
- Headless mode

**Benefit**: Progressive customization without breaking changes

## Usage Patterns

### Tier 1: Default (Zero Config)

```javascript
const adapter = new HubotChatAdapter(robot)
// Uses DefaultUIProvider automatically
```

**What happens**:
1. Adapter creates `DefaultUIProvider`
2. HTTP server serves built-in `public/` files
3. Client shows nickname modal
4. No auth hooks registered

### Tier 2: Auth Configuration

```javascript
const adapter = new HubotChatAdapter(robot, {
  auth: {
    type: 'login',
    fields: ['username', 'password'],
    handler: async (credentials) => {
      return await validateUser(credentials)
    }
  }
})
```

**What happens**:
1. Adapter creates `AuthUIProvider` with config
2. Auth handler automatically registered as auth hook
3. HTTP server serves UI with injected config
4. Client reads config and renders login form
5. Credentials passed to handler on connection

### Tier 3: Custom UI

```javascript
const adapter = new HubotChatAdapter(robot, {
  uiProvider: new CustomUIProvider('./my-ui')
})
```

**What happens**:
1. Adapter uses provided UIProvider
2. HTTP server delegates to your provider
3. You control all HTML/CSS/JS
4. WebSocket protocol unchanged

### Tier 4: Headless

```javascript
const adapter = new HubotChatAdapter(robot, {
  uiProvider: null
})
```

**What happens**:
1. No HTTP routes registered
2. Only WebSocket server active
3. Your app provides UI separately
4. Connects directly to WebSocket

## Extension Points

### 1. Authentication UI

**Interface**: Provide `auth` config with `type` and `handler`
**Default behavior**: Nickname modal
**Custom behavior**: Login form, SSO, token-based

### 2. UI Assets

**Interface**: Implement `UIProvider`
**Default behavior**: Serve `public/` directory
**Custom behavior**: React/Vue app, CDN, dynamic generation

### 3. Authentication Logic

**Interface**: Implement auth hook
**Default behavior**: Allow all nicknames
**Custom behavior**: Database check, OAuth, JWT

### 4. Authorization Logic

**Interface**: Implement authz hook
**Default behavior**: Allow all actions
**Custom behavior**: Role-based, attribute-based

## Testing Strategy

Each layer can be tested independently:

### Domain Layer
- Unit tests with no mocks
- Test business rules in isolation

### Protocol Layer
- Mock WebSocket connections
- Test message handling logic
- Verify hook invocation

### HTTP Layer
- Mock router and UIProvider
- Test route registration
- Verify error handling

### UI Providers
- Test each implementation
- Verify contract compliance
- Test with different configurations

### Integration
- Test complete flows
- Verify layers work together
- Test backward compatibility

## Migration Path

**Existing code**: Zero changes required ✅
- `HubotChatAdapter(robot)` works exactly as before
- All existing tests pass
- Default UI unchanged

**New features**: Purely additive
- `auth` option for Tier 2
- `uiProvider` option for Tier 3
- Hook API unchanged

## Benefits Summary

1. **Testability**: Each layer independently testable
2. **Flexibility**: Multiple customization points
3. **Clarity**: Each file has single, clear purpose
4. **Maintainability**: Changes isolated to specific layers
5. **Backward Compatibility**: Zero breaking changes
6. **Progressive Enhancement**: Simple → Configured → Custom
7. **Open/Closed**: Open for extension, closed for modification
