class ChatClient {
  constructor () {
    this.ws = null
    this.sessionId = null
    this.nickname = null
    this.activeRoomId = null
    this.rooms = new Map()
    this.messages = new Map()
    this.users = new Map()
    this.unreadRooms = new Set()
    this.pendingInviteToken = this.getInviteTokenFromUrl()

    this.cacheElements()
    this.setupEventListeners()
    this.hydrateNickname()
  }

  cacheElements () {
    this.nicknameModal = document.getElementById('nicknameModal')
    this.nicknameInput = document.getElementById('nicknameInput')
    this.nicknameBtn = document.getElementById('nicknameBtn')

    this.createRoomModal = document.getElementById('createRoomModal')
    this.roomNameInput = document.getElementById('roomNameInput')
    this.createRoomSubmitBtn = document.getElementById('createRoomSubmitBtn')
    this.cancelCreateRoomBtn = document.getElementById('cancelCreateRoomBtn')

    this.inviteModal = document.getElementById('inviteModal')
    this.inviteLinkInput = document.getElementById('inviteLinkInput')
    this.copyInviteBtn = document.getElementById('copyInviteBtn')
    this.closeInviteBtn = document.getElementById('closeInviteBtn')

    this.dmModal = document.getElementById('dmModal')
    this.dmSearchInput = document.getElementById('dmSearchInput')
    this.dmResults = document.getElementById('dmResults')
    this.dmBtn = document.getElementById('dmBtn')
    this.dmCancelBtn = document.getElementById('dmCancelBtn')

    this.roomsList = document.getElementById('roomsList')
    this.newRoomBtn = document.getElementById('newRoomBtn')
    this.chatHeader = document.getElementById('chatHeader')
    this.roomTitle = document.getElementById('roomTitle')
    this.messagesEl = document.getElementById('messages')
    this.messageInput = document.getElementById('messageInput')
    this.sendBtn = document.getElementById('sendBtn')
  }

  setupEventListeners () {
    this.nicknameInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') this.joinWithNickname()
    })
    this.nicknameBtn.addEventListener('click', () => this.joinWithNickname())

    this.newRoomBtn.addEventListener('click', () => this.showCreateRoomModal())
    this.createRoomSubmitBtn.addEventListener('click', () => this.createRoom())
    this.cancelCreateRoomBtn.addEventListener('click', () => this.hideCreateRoomModal())

    this.copyInviteBtn.addEventListener('click', () => this.copyInviteLink())
    this.closeInviteBtn.addEventListener('click', () => this.hideInviteModal())

    this.dmBtn.addEventListener('click', () => this.showDmModal())
    this.dmCancelBtn.addEventListener('click', () => this.hideDmModal())
    this.dmSearchInput.addEventListener('input', () => this.renderDmResults())
    this.dmSearchInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') this.submitDmSearch()
    })

    this.messageInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') this.sendMessage()
    })
    this.sendBtn.addEventListener('click', () => this.sendMessage())
  }

  hydrateNickname () {
    const stored = localStorage.getItem('hubot-chat-nickname')
    if (stored) this.nicknameInput.value = stored
  }

  getInviteTokenFromUrl () {
    const params = new URLSearchParams(window.location.search)
    return params.get('invite')
  }

  clearInviteFromUrl () {
    const url = new URL(window.location.href)
    url.searchParams.delete('invite')
    window.history.replaceState({}, document.title, url.pathname)
  }

  joinWithNickname () {
    const nickname = this.nicknameInput.value.trim()
    if (!nickname) {
      alert('Please enter a nickname')
      return
    }

    this.nickname = nickname
    localStorage.setItem('hubot-chat-nickname', nickname)
    this.hideNicknameModal()
    this.connect()
  }

  connect () {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.ws = new WebSocket(`${protocol}//${window.location.host}`)

    const storedSessionId = localStorage.getItem('hubot-chat-session-id')

    this.ws.addEventListener('open', () => {
      this.ws.send(JSON.stringify({
        type: 'hello',
        payload: { nickname: this.nickname, sessionId: storedSessionId }
      }))
    })

    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      this.handleMessage(msg)
    })

    this.ws.addEventListener('close', () => {
      console.log('WebSocket closed')
    })

    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error)
    })
  }

  handleMessage (msg) {
    const { type, payload, error } = msg

    if (type === 'state.init') return this.handleInit(payload)
    if (type === 'room.created') return this.handleRoomCreated(payload)
    if (type === 'room.joined') return this.handleRoomJoined(payload)
    if (type === 'message.new') return this.handleMessageNew(payload)
    if (type === 'user.joined') return this.handleUserJoined(payload)
    if (type === 'user.left') return this.handleUserLeft(payload)
    if (type === 'error') return alert(`Error: ${error}`)
  }

  handleInit (payload) {
    this.sessionId = payload.session.sessionId
    localStorage.setItem('hubot-chat-session-id', this.sessionId)
    this.rooms.clear()
    this.messages.clear()
    this.users.clear()

    for (const room of payload.rooms) {
      this.rooms.set(room.roomId, room)
      const history = payload.messagesByRoomId?.[room.roomId] || []
      this.messages.set(room.roomId, history)
    }

    for (const user of payload.users || []) {
      this.users.set(user.sessionId, user.nickname)
    }

    this.enableInput()
    this.renderRoomsList()

    if (payload.defaultRoomId) {
      this.setActiveRoom(payload.defaultRoomId)
    }

    if (this.pendingInviteToken) {
      this.joinByInvite(this.pendingInviteToken)
      this.pendingInviteToken = null
      this.clearInviteFromUrl()
    }
  }

  handleUserJoined (payload) {
    if (!payload?.sessionId || !payload?.nickname) return
    this.users.set(payload.sessionId, payload.nickname)
    if (this.dmModal.classList.contains('active')) this.renderDmResults()
  }

  handleUserLeft (payload) {
    if (!payload?.sessionId) return
    this.users.delete(payload.sessionId)
    if (this.dmModal.classList.contains('active')) this.renderDmResults()
  }

  handleRoomCreated (payload) {
    if (!payload?.room) return
    const { room, invite } = payload

    this.rooms.set(room.roomId, room)
    if (!this.messages.has(room.roomId)) this.messages.set(room.roomId, [])

    this.renderRoomsList()

    if (invite?.token) {
      const url = new URL(window.location.href)
      url.searchParams.set('invite', invite.token)
      this.showInviteModal(url.toString())
    }
  }

  handleRoomJoined (payload) {
    if (!payload?.roomId) return

    if (payload.isSelf && payload.room) {
      this.rooms.set(payload.room.roomId, payload.room)
      const history = payload.history || []
      this.messages.set(payload.room.roomId, history)
      this.unreadRooms.delete(payload.room.roomId)
      this.setActiveRoom(payload.room.roomId)
      this.renderRoomsList()
      return
    }

    if (payload.roomId === this.activeRoomId && !payload.isSelf) {
      this.addSystemMessage(payload.roomId, `${payload.nickname} joined`)
    }
  }

  handleMessageNew (payload) {
    if (!this.messages.has(payload.roomId)) {
      this.messages.set(payload.roomId, [])
    }

    this.messages.get(payload.roomId).push(payload)

    if (payload.roomId === this.activeRoomId) {
      this.renderMessages()
    } else {
      this.unreadRooms.add(payload.roomId)
      this.renderRoomsList()
    }
  }

  joinRoom (roomId) {
    if (!roomId || !this.ws || this.ws.readyState !== 1) return
    this.ws.send(JSON.stringify({
      type: 'room.join',
      payload: { roomId }
    }))
  }

  joinByInvite (token) {
    if (!token || !this.ws || this.ws.readyState !== 1) return
    this.ws.send(JSON.stringify({
      type: 'room.joinByInvite',
      payload: { inviteToken: token }
    }))
  }

  showCreateRoomModal () {
    this.createRoomModal.classList.add('active')
    this.roomNameInput.focus()
  }

  hideCreateRoomModal () {
    this.createRoomModal.classList.remove('active')
    this.roomNameInput.value = ''
  }

  showInviteModal (link) {
    this.inviteLinkInput.value = link
    this.inviteModal.classList.add('active')
  }

  hideInviteModal () {
    this.inviteModal.classList.remove('active')
  }

  showDmModal () {
    this.dmModal.classList.add('active')
    this.dmSearchInput.value = ''
    this.renderDmResults()
    this.dmSearchInput.focus()
  }

  hideDmModal () {
    this.dmModal.classList.remove('active')
  }

  async copyInviteLink () {
    const link = this.inviteLinkInput.value
    if (!link) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      } else {
        this.inviteLinkInput.select()
        document.execCommand('copy')
      }
    } catch (error) {
      console.error('Failed to copy invite', error)
    }
  }

  createRoom () {
    const name = this.roomNameInput.value.trim()
    const visibility = document.querySelector('input[name="visibility"]:checked').value

    if (!name) {
      alert('Please enter a room name')
      return
    }

    this.ws.send(JSON.stringify({
      type: 'room.create',
      payload: { name, visibility }
    }))

    this.hideCreateRoomModal()
  }

  sendMessage () {
    const text = this.messageInput.value.trim()
    if (!text || !this.activeRoomId) return

    this.ws.send(JSON.stringify({
      type: 'message.send',
      payload: { roomId: this.activeRoomId, text }
    }))

    this.messageInput.value = ''
  }

  submitDmSearch () {
    const query = this.dmSearchInput.value.trim().toLowerCase()
    if (!query) return
    const match = this.findUsersByQuery(query)[0]
    if (!match) return
    this.startDirectMessage(match.nickname)
  }

  startDirectMessage (nickname) {
    if (!nickname || !this.ws || this.ws.readyState !== 1) return
    this.ws.send(JSON.stringify({
      type: 'dm.start',
      payload: { nickname }
    }))
    this.hideDmModal()
  }

  setActiveRoom (roomId) {
    this.activeRoomId = roomId
    this.unreadRooms.delete(roomId)
    this.renderRoomsList()
    this.renderChatHeader()
    this.renderMessages()
    this.messageInput.focus()
  }

  addSystemMessage (roomId, text) {
    if (!this.messages.has(roomId)) this.messages.set(roomId, [])

    this.messages.get(roomId).push({
      messageId: crypto.randomUUID(),
      roomId,
      sessionId: 'system',
      nickname: 'system',
      text,
      createdAt: new Date().toISOString(),
      isSystem: true
    })

    if (roomId === this.activeRoomId) this.renderMessages()
  }

  renderRoomsList () {
    this.roomsList.innerHTML = ''

    for (const [roomId, room] of this.rooms) {
      const item = document.createElement('div')
      item.className = `room-item ${roomId === this.activeRoomId ? 'active' : ''}`
      const showUnread = this.unreadRooms.has(roomId)
      item.innerHTML = `
        <div class="room-item-name">${this.formatRoomName(room)}</div>
        <div class="room-item-visibility">
          ${this.formatRoomVisibility(room)}
          ${showUnread ? '<span class="room-unread" aria-label="unread"></span>' : ''}
        </div>
      `

      item.addEventListener('click', () => {
        this.joinRoom(roomId)
        this.setActiveRoom(roomId)
      })

      this.roomsList.appendChild(item)
    }
  }

  renderChatHeader () {
    const room = this.rooms.get(this.activeRoomId)
    if (!room) {
      this.roomTitle.textContent = 'Select a room'
      return
    }

    this.roomTitle.textContent = this.formatRoomName(room)
  }

  renderMessages () {
    const roomMessages = this.messages.get(this.activeRoomId) || []
    this.messagesEl.innerHTML = ''

    for (const msg of roomMessages) {
      const div = document.createElement('div')
      div.className = `message ${msg.isSystem ? 'system' : ''}`

      if (msg.isSystem) {
        div.innerHTML = `<div class="message-text">${msg.text}</div>`
      } else {
        const time = new Date(msg.createdAt).toLocaleTimeString()
        div.innerHTML = `
          <div class="message-user">${msg.nickname}</div>
          <div class="message-text">${msg.text}</div>
          <div class="message-time">${time}</div>
        `
      }

      this.messagesEl.appendChild(div)
    }

    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  hideNicknameModal () {
    this.nicknameModal.classList.remove('active')
  }

  enableInput () {
    this.messageInput.disabled = false
    this.sendBtn.disabled = false
  }

  formatRoomName (room) {
    if (!room?.name) return ''
    if (!room.name.startsWith('dm:')) return room.name

    const rawNames = room.name.slice(3).split(',').map(name => name.trim())
    const other = rawNames.find(name => name.toLowerCase() !== this.nickname?.toLowerCase())
    return other ? `DM with ${other}` : 'Direct message'
  }

  formatRoomVisibility (room) {
    if (room?.name?.startsWith('dm:')) return 'dm'
    return room.visibility
  }

  findUsersByQuery (query) {
    const results = []
    for (const [id, nickname] of this.users.entries()) {
      if (id === this.sessionId) continue
      if (!nickname) continue
      if (nickname.toLowerCase().includes(query)) {
        results.push({ sessionId: id, nickname })
      }
    }
    return results.sort((a, b) => a.nickname.localeCompare(b.nickname))
  }

  renderDmResults () {
    const query = this.dmSearchInput.value.trim().toLowerCase()
    const results = query ? this.findUsersByQuery(query) : this.findUsersByQuery('')

    this.dmResults.innerHTML = ''

    if (results.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'dm-empty'
      empty.textContent = 'No matches'
      this.dmResults.appendChild(empty)
      return
    }

    for (const user of results) {
      const item = document.createElement('div')
      item.className = 'dm-result'
      item.textContent = user.nickname
      item.addEventListener('click', () => this.startDirectMessage(user.nickname))
      this.dmResults.appendChild(item)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new ChatClient()
})