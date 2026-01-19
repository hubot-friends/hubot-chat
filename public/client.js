class ChatClient {
  constructor () {
    this.ws = null
    this.sessionId = null
    this.nickname = null
    this.activeRoom = null
    this.rooms = new Map()
    this.messages = new Map()
    
    this.setupEventListeners()
    this.checkStoredNickname()
  }

  setupEventListeners () {
    // Nickname modal
    document.getElementById('nicknameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinWithNickname()
      }
    })
    document.getElementById('nicknameBtn').addEventListener('click', () => {
      this.joinWithNickname()
    })

    // Create room
    document.getElementById('newRoomBtn').addEventListener('click', () => {
      this.showCreateRoomModal()
    })
    document.getElementById('createRoomSubmitBtn').addEventListener('click', () => {
      this.createRoom()
    })
    document.getElementById('cancelCreateRoomBtn').addEventListener('click', () => {
      this.hideCreateRoomModal()
    })

    // Message input
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage()
      }
    })
    document.getElementById('sendBtn').addEventListener('click', () => {
      this.sendMessage()
    })
  }

  checkStoredNickname () {
    const stored = localStorage.getItem('hubot-chat-nickname')
    if (stored) {
      document.getElementById('nicknameInput').value = stored
    }
  }

  joinWithNickname () {
    const input = document.getElementById('nicknameInput')
    const nickname = input.value.trim()
    
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
    
    this.ws.addEventListener('open', () => {
      this.ws.send(JSON.stringify({
        type: 'hello',
        payload: { nickname: this.nickname }
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
    
    if (type === 'state.init') {
      this.sessionId = payload.session.sessionId
      this.rooms.clear()
      this.messages.clear()
      
      for (const room of payload.rooms) {
        this.rooms.set(room.roomId, room)
        this.messages.set(room.roomId, [])
      }
      
      this.enableInput()
      this.renderRoomsList()
      if (payload.generalRoomId) {
        this.joinRoom(payload.generalRoomId)
      }
    } else if (type === 'room.created') {
      this.rooms.set(payload.roomId, payload)
      this.messages.set(payload.roomId, [])
      this.renderRoomsList()
    } else if (type === 'room.joined') {
      if (payload.roomId === this.activeRoom) {
        this.addSystemMessage(payload.roomId, `${payload.nickname} joined`)
      }
    } else if (type === 'message.new') {
      if (!this.messages.has(payload.roomId)) {
        this.messages.set(payload.roomId, [])
      }
      this.messages.get(payload.roomId).push(payload)
      
      if (payload.roomId === this.activeRoom) {
        this.renderMessages()
      }
    } else if (type === 'error') {
      alert(`Error: ${error}`)
    }
  }

  joinRoom (roomId) {
    this.activeRoom = roomId
    
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({
        type: 'room.join',
        payload: { roomId }
      }))
    }
    
    this.renderRoomsList()
    this.renderChatHeader()
    this.renderMessages()
  }

  joinByInvite (token) {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({
        type: 'room.joinByInvite',
        payload: { inviteToken: token }
      }))
    }
  }

  showCreateRoomModal () {
    document.getElementById('createRoomModal').classList.add('active')
    document.getElementById('roomNameInput').focus()
  }

  hideCreateRoomModal () {
    document.getElementById('createRoomModal').classList.remove('active')
    document.getElementById('roomNameInput').value = ''
  }

  createRoom () {
    const name = document.getElementById('roomNameInput').value.trim()
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
    const input = document.getElementById('messageInput')
    const text = input.value.trim()
    
    if (!text || !this.activeRoom) return
    
    this.ws.send(JSON.stringify({
      type: 'message.send',
      payload: { roomId: this.activeRoom, text }
    }))
    
    input.value = ''
  }

  addSystemMessage (roomId, text) {
    if (!this.messages.has(roomId)) {
      this.messages.set(roomId, [])
    }
    
    this.messages.get(roomId).push({
      messageId: Math.random(),
      roomId,
      sessionId: 'system',
      nickname: 'system',
      text,
      createdAt: new Date().toISOString(),
      isSystem: true
    })
    
    if (roomId === this.activeRoom) {
      this.renderMessages()
    }
  }

  renderRoomsList () {
    const list = document.getElementById('roomsList')
    list.innerHTML = ''
    
    for (const [roomId, room] of this.rooms) {
      const item = document.createElement('div')
      item.className = `room-item ${roomId === this.activeRoom ? 'active' : ''}`
      item.innerHTML = `
        <div class="room-item-name">${room.name}</div>
        <div class="room-item-visibility">${room.visibility}</div>
      `
      item.addEventListener('click', () => this.joinRoom(roomId))
      list.appendChild(item)
    }
  }

  renderChatHeader () {
    const header = document.getElementById('chatHeader')
    const room = this.rooms.get(this.activeRoom)
    
    if (room) {
      header.innerHTML = `<h2>${room.name}</h2>`
    }
  }

  renderMessages () {
    const container = document.getElementById('messages')
    const roomMessages = this.messages.get(this.activeRoom) || []
    
    container.innerHTML = ''
    
    for (const msg of roomMessages) {
      const div = document.createElement('div')
      div.className = `message ${msg.isSystem ? 'system' : ''}`
      
      const time = new Date(msg.createdAt).toLocaleTimeString()
      
      if (msg.isSystem) {
        div.innerHTML = `<div class="message-text">${msg.text}</div>`
      } else {
        div.innerHTML = `
          <div class="message-user">${msg.nickname}</div>
          <div class="message-text">${msg.text}</div>
          <div class="message-time">${time}</div>
        `
      }
      
      container.appendChild(div)
    }
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight
  }

  hideNicknameModal () {
    document.getElementById('nicknameModal').classList.remove('active')
  }

  enableInput () {
    document.getElementById('messageInput').disabled = false
    document.getElementById('sendBtn').disabled = false
  }
}

// Initialize client when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ChatClient()
})
