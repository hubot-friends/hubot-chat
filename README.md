# hubot-chat

A private, ephemeral chat application where Hubot is native.

## Quick Start

```bash
npm install
npm run dev                          # starts on port 3000
HUBOT_CHAT_PERSIST=./data/chat.db npm run dev
node --env-file-if-exists=.env --watch ./node_modules/hubot/bin/Hubot.mjs -a @hubot-friends/hubot-chat
```

## Architecture

### Core Modules

- **Session** (`src/session.mjs`) - User session management
- **Room** (`src/room.mjs`) - Room creation, listing, membership
- **Message** (`src/message.mjs`) - Message storage and retrieval
- **Invite** (`src/invite.mjs`) - Single-use invite tokens with TTL
- **HubotChatAdapter** (`src/adapter.mjs`) - Hubot adapter integration
- **Persistence** (`src/persistence.mjs`) - SQLite persistence (optional)
- **Server** (`src/server.mjs`) - WebSocket + Hubot HTTP server integration

### Key Features

- **In-Memory by Default**: All data lives in memory until restart
- **Optional Persistence**: Use `--persist ./data.db` to save to SQLite
- **WebSocket Protocol**: Real-time chat via WebSockets
- **Public + Private Rooms**: Public rooms visible to all, private rooms join via invite
- **Single-Use Invites**: Invite tokens expire after first use or 24 hours
- **Hubot Integration**: All messages forwarded to Hubot for processing
- **Vanilla UI**: No frameworks, pure HTML/CSS/JavaScript
- **Mobile-First Responsive Design**: Touch-friendly interface that adapts from mobile to desktop

### Responsive Design

The UI uses a mobile-first responsive approach:

- **Mobile (< 768px)**: Single-column layout with rooms list and chat area stacked vertically
  - Rooms sidebar: 40vh max height, scrollable
  - Chat area: Flexible, takes remaining space
  - Touch-friendly buttons and inputs (48px+ tap targets)
  
- **Tablet/Desktop (≥ 768px)**: Side-by-side layout
  - Fixed-width sidebar (280px) on the left
  - Main chat area takes remaining space
  - Optimized spacing and typography

## Development

### Testing

All core functionality uses TDD with Node's native test runner:

```bash
npm test
```

30 tests covering:
- Session creation and retrieval
- Room management
- Message history
- Invite system
- Persistence layer

### File Structure

```
.
├── public/
│   ├── index.html               # Client UI
│   ├── style.css                # Styling
│   └── client.mjs               # Client-side logic
├── src/
│   ├── index.mjs                # Adapter entry
│   ├── adapter.mjs              # Hubot adapter implementation
│   ├── session.mjs              # Session management
│   ├── room.mjs                 # Room management
│   ├── message.mjs              # Message store
│   ├── invite.mjs               # Invite system
│   ├── persistence.mjs          # SQLite layer
│   └── server.mjs               # WebSocket + Hubot HTTP server
├── tests/
│   ├── session.test.mjs
│   ├── room.test.mjs
│   ├── message.test.mjs
│   ├── invite.test.mjs
│   └── persistence.test.mjs
├── package.json
└── DESIGN_DOC.md                # Full design specification
```

## WebSocket Protocol

### Client → Server

```json
{ "type": "hello", "payload": { "nickname": "alice", "sessionId": "..." } }
{ "type": "room.create", "payload": { "name": "general", "visibility": "public" } }
{ "type": "room.join", "payload": { "roomId": "..." } }
{ "type": "room.joinByInvite", "payload": { "inviteToken": "..." } }
{ "type": "message.send", "payload": { "roomId": "...", "text": "hello" } }
{ "type": "dm.start", "payload": { "nickname": "bob" } }
```

### Server → Client

```json
{ "type": "state.init", "payload": { "session": {...}, "rooms": [...], "defaultRoomId": "..." } }
{ "type": "room.created", "payload": { "room": { "roomId": "...", "name": "..." }, "invite": null } }
{ "type": "room.joined", "payload": { "roomId": "...", "nickname": "..." } }
{ "type": "message.new", "payload": { "messageId": "...", "text": "...", ... } }
{ "type": "user.joined", "payload": { "sessionId": "...", "nickname": "..." } }
{ "type": "user.left", "payload": { "sessionId": "..." } }
{ "type": "error", "error": "..." }
```

## Hubot Integration

The adapter forwards all messages to Hubot's `robot.receive()`. Hubot scripts decide whether to respond.

Hubot output becomes a chat message from the system user "hubot".

## Persistence

By default, all data is ephemeral (lost on restart). Use `HUBOT_CHAT_PERSIST` to enable SQLite:

```bash
HUBOT_CHAT_PERSIST=./data.db npm run dev
```

The database is append-only:
- Rooms: insert only
- Memberships: append-only
- Messages: append-only
- Invites: consumed via event log
- Invite Events: append-only

State is recovered on startup by replaying persisted data.

## Configuration

```
HUBOT_CHAT_PERSIST=./data.db
HUBOT_CHAT_INVITE_TTL_HOURS=24
```

## Dependencies

- `ws` - WebSocket server
- `hubot` - Chat bot framework (optional, for scripts)
- Node.js 25.2.0+ (for native SQLite support)
