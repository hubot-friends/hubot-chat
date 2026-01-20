# hubot-chat — Design Document (DESIGN_DOC.md)
Version: v0.7
Date: 2026-01-19
Author: Joey Guerra

Core principle:
Keep third-party dependencies to an absolute minimum.
If we can code it ourselves, we do.

---------------------------------------------------------------------

## 0. One-Sentence Concept

hubot-chat is a chat application you can spin up instantly with:

npx hubot --create myhubot -a @hubot-friends/hubot-chat
cd myhubot
npm start

to host a private, ephemeral conversation with a small group—where
Hubot is the system and chat is the UI.

---------------------------------------------------------------------

## 1. Product Intent

Hubot has existed since 2013, but it typically lives inside other chat
systems (Slack, Discord, etc.).

This project flips that relationship.

hubot-chat is the chat app where Hubot is native.

Primary job-to-be-done:

> I want to start up a private instance of chat so I can have an
ephemeral conversation with some people.

Goals:
- Zero-friction startup (npm install + npx)
- No auth or external services required
- Multiple rooms (public + private) on day one
- Hubot always running, always receiving messages
- Persistence is optional and layered
- Works well for local, private, ad-hoc conversations

Explicit Non-Goals (Layer 0):
- OAuth / SSO
- Role-based permissions
- Threads, reactions, unread counts
- File uploads
- Multi-node clustering
- Enterprise moderation workflows

---------------------------------------------------------------------

## 2. Default Behavior

Default Run Mode:

npx hubot --create myhubot -a @hubot-friends/hubot-chat
cd myhubot
npm start

- Single Node.js process
- In-memory only
- Unlimited message history until restart
- Nickname-based identity
- Nickname stored in browser localStorage
- Multiple rooms (public + private)
- Hubot runtime always on
- Hubot receives all messages
- Vanilla HTML + CSS + JS UI
- Realtime via WebSockets

Optional Persistence:

HUBOT_CHAT_PERSIST=./data/chat.sqlite npm start

- Uses Node’s native SQLite module
- SQLite tables are insert-only
- In-memory state remains authoritative
- Persistence is asynchronous and ordered

---------------------------------------------------------------------

## 3. User Stories (Jobs-To-Be-Done)

1. As a builder, I want to spin up a private chat instance quickly so I
   can gather people for an ephemeral conversation.

2. As a new user, I want to choose a nickname and start chatting
   immediately without creating an account.

3. As a host, I want to create private rooms so conversations don’t
   collide.

4. As a host, I want to invite someone with a link so onboarding is
   frictionless.

5. As a host, I want invite links to be safe by default (single-use +
   time-limited).

6. As a participant, I want Hubot present in the room so automation can
   participate naturally.

7. As a returning browser user, I want my nickname remembered locally.

---------------------------------------------------------------------

## 4. Core Concepts (“Atoms”)

Session
- sessionId
- nickname
- createdAt

Room
- roomId
- name
- visibility: public | private
- createdAt
- createdBySessionId
- dm rooms use name prefix: dm:{nicknameA},{nicknameB}

Membership
- roomId
- sessionId
- joinedAt

Message
- messageId
- roomId
- sessionId
- nickname
- text
- createdAt

Invite
- inviteId
- roomId
- tokenHash
- createdAt
- expiresAt

Invariants:
- Messages are immutable
- Membership changes are append-only events
- Invites expire after first successful use
- Invites expire after 24 hours by default
- Server timestamps are authoritative
- DM rooms are private and only visible to their members

---------------------------------------------------------------------

## 5. Room Model

Public Rooms:
- Visible to all users
- Anyone may join

Private Rooms:
- Visible only to members
- Joined via invite link
- Nickname-based (no auth)
- Intended for ad-hoc, ephemeral groups

Direct Message Rooms:
- Created when a user starts a DM by nickname
- Only contains the two participants
- Uses a private room with a dm: name prefix
- No invites required

Room Discovery Rules:
- Show all public rooms
- Show only private rooms user belongs to
- Do not show locked or placeholder rooms

---------------------------------------------------------------------

## 6. Invites

Properties:
- Single-use
- Expire after first successful join
- Expire after 24 hours by default

Flow:
1. Host creates private room
2. System generates invite token
3. Invite link is shared
4. First successful join consumes invite
5. Any further attempts fail

Direct Message Flow:
1. User searches for a nickname
2. System creates or reuses a dm room
3. Sender is auto-joined
4. Recipient sees the DM room in the list with an unread indicator

---------------------------------------------------------------------

## 7. UI Specification (Vanilla)

Layout:

[ Rooms Sidebar ] [ Active Room Messages ]
[ + New Room ]
[ Message Input ]

Additional UI (Direct Messages):

[ Direct message ] button
[ Search by nickname ] modal

Characteristics:
- No unread counts
- No threads
- No reactions
- No rich formatting
- Fast and boring by design
- Direct messages are just private rooms
- DM search lists currently connected users only
- DM rooms show a blue unread dot when new messages arrive

---------------------------------------------------------------------

## 8. Transport Protocol (WebSocket)

Client to Server:
- hello { nickname }
- hello { nickname, sessionId }
- room.create { name, visibility }
- room.join { roomId }
- room.joinByInvite { inviteToken }
- message.send { roomId, text }
- dm.start { nickname }

Server to Client:
- state.init
- room.created
- room.joined
- message.new
- user.joined
- user.left
- error

---------------------------------------------------------------------

## 9. Hubot Integration

Core stance:
hubot-chat does not implement addressing rules.

All accepted messages are forwarded to the Hubot Robot.
Hubot scripts decide whether they hear or respond.

Behavior:
- Hubot runs in-process
- All messages forwarded to robot.receive()
- Hubot output becomes chat messages from:
  sessionId: hubot
  nickname: hubot

Script loading:
- Use Hubots built-in design

---------------------------------------------------------------------

## 10. Persistence (--persist)

Goals:
- Insert-only
- Preserve hot-path performance
- No blocking on disk I/O
- Recover state on restart

Strategy:
- In-memory state is authoritative
- SQLite used as append-only event log
- Writes occur asynchronously

Tables:
- rooms
- memberships (append-only)
- messages (append-only)
- invites
- invite_events (append-only)

Invite validity:
- created event exists
- no consumed event
- current time < expires_ts

---------------------------------------------------------------------

## 11. CLI Interface

npm start
HUBOT_CHAT_PERSIST=./data/chat.sqlite npm start
HUBOT_CHAT_INVITE_TTL_HOURS=24 npm start

Session Restore
- Client stores sessionId in localStorage
- Client sends sessionId on hello
- Server reuses session and memberships if present

---------------------------------------------------------------------

## 12. XP-Style Implementation Slices

1. WebSocket connect → nickname → messaging
2. Multiple rooms + switching
3. Private rooms + invite join
4. Direct messages by nickname
5. Hubot runtime + adapter
6. SQLite persistence (--persist)

Each slice must produce a usable system.

---------------------------------------------------------------------

## 13. Guiding Philosophy

- Start boring
- Keep the hot path in memory
- Make every capability a layer
- Prefer clarity over cleverness
- Let Hubot remain Hubot

hubot-chat is not Slack.
It is the simplest chat substrate where Hubot is finally at home.

---------------------------------------------------------------------

## 14. Copilot / Codex Build Prompt

Context

You are building hubot-chat, a minimal chat application in Node.js where Hubot is the system and chat is the UI.

Core constraints:
- Vanilla HTML, CSS, and JavaScript only (no frameworks)
- Keep third-party dependencies to an absolute minimum
- If something can reasonably be coded, code it instead of installing a package
- Single Node.js process
- WebSocket-based realtime messaging
- Hubot runs in-process and receives all messages

⸻

🎯 Objective

Implement Layer 0 of hubot-chat:
- npx @hubot-friends/hubot-chat --port 3000 starts a chat server
- Users join by choosing a nickname (stored in localStorage)
- Multiple rooms exist on day one (public + private)
- Private rooms are joined via single-use invite links
- Invite links expire after first use or after 24 hours
- Users see:
- all public rooms
- only private rooms they are members of
- DM rooms for one-to-one chats
- Unlimited message history in memory until restart
- Optional persistence via --persist <sqlite db file path>
- Hubot is always running and receives all messages
- Hubot scripts decide what to hear/respond to

⸻

🧠 Architectural Decisions (Do Not Change)
- Chat server is the Hubot runtime
- Chat messages are forwarded to robot.receive() unconditionally
- Hubot output is rendered as chat messages from:
- sessionId: "hubot"
- nickname: "hubot"
- No addressing logic in chat layer
- No auth, roles, permissions, or enterprise features
- DMs are implemented as private rooms

⸻

🧩 Core Domain Concepts

Implement these in-memory structures:
- Session { sessionId, nickname, createdAt }
- Room { roomId, name, visibility, createdAt, createdBySessionId }
- Membership { roomId, sessionId, joinedAt }
- Message { messageId, roomId, sessionId, nickname, text, createdAt }
- Invite { inviteId, roomId, tokenHash, expiresAt }
- DirectMessageRoom { roomId, name, sessionIdA, sessionIdB }

Rules:
- Messages are immutable
- Membership changes are append-only
- Invites are single-use and time-limited
- Server timestamps are authoritative

⸻

🔌 WebSocket Protocol

Client → Server
- hello { nickname }
- hello { nickname, sessionId }
- room.create { name, visibility }
- room.join { roomId }
- room.joinByInvite { inviteToken }
- message.send { roomId, text }
- dm.start { nickname }

Server → Client
- state.init
- room.created
- room.joined
- message.new
- user.joined
- user.left
- error

⸻

🖥️ UI Requirements (Vanilla)
- Mobile first
- Responsive design
- Left sidebar: room list
- Main area: messages for active room
- Bottom input: send message
- Room list UX:
- Click to switch rooms
- Public rooms auto-join on click
- Private rooms visible only if member
- “+ New room” button
- “Direct message” button
- DM search modal by nickname
- No unread counts, no threads, no reactions

⸻

🔒 Private Room + Invite Logic
- Private rooms require invite token
- Invite link:
- single-use
- expires after first successful join
- expires after 24 hours by default
- After successful join:
- invite is immediately consumed
- room appears in user’s room list

💬 Direct Messages
- Users can start a DM by nickname
- DM creates a private room with two members
- Only connected users are discoverable
- Recipient is not auto-joined
- Recipient sees a blue unread dot until opening the DM

⸻

🤖 Hubot Integration
- Run Hubot in-process
- Chat bot developers can just leverage Hubot's script loading design (e.g. scripts in `scripts/` folder)
- Forward all accepted messages to robot.receive()
- Convert Hubot output into chat messages
- Do not implement command routing or filtering

⸻

💾 Optional Persistence (--persist)
- Use Node’s native SQLite module
- Insert-only tables
- In-memory state is authoritative
- Async persistence only (never block message delivery)

Tables:
- rooms
- memberships (append-only)
- messages (append-only)
- invites
- invite_events (created | consumed)

Invite validity:
- created event exists
- no consumed event
- now < expires_ts

⸻

🛠️ CLI Interface

Support:
- --port <number>
- --persist <sqlite path>
- --invite-ttl-hours <number> (default 24)

⸻

🧪 Implementation Guidance
- Build in thin vertical slices
- Start with:
	1.	WebSocket connect → nickname → lobby messaging
	2.	Multiple rooms
	3.	Private rooms + invites
	4.	Direct messages by nickname
	5.	Hubot adapter
	6.	SQLite persistence
- Prefer clarity over cleverness
- Write code that is easy to debug

⸻

🚫 Explicitly Do NOT Implement
- OAuth / SSO
- Permissions
- Notifications
- Threads
- Reactions
- Presence indicators
- Frontend frameworks
- Large dependency trees

⸻

Private Rooms
Enable a user who joins a private room with an invite to refresh and still participate by restoring their sessionId.

🧭 Philosophy

hubot-chat is not Slack.
It is the simplest chat substrate where Hubot is finally at home.

Build accordingly.