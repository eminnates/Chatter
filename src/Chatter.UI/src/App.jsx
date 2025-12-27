import { useState, useEffect, useRef, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'

const API_URL = 'https://aretha-intercompany-corinna.ngrok-free.dev/api';
const HUB_URL = 'https://aretha-intercompany-corinna.ngrok-free.dev/hubs/chat';
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

function App() {
  // === AUTH STATES ===
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch {
      return null
    }
  })
  
  // === CHAT & UI STATES ===
  const [users, setUsers] = useState([]) 
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [connection, setConnection] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  
  // === LOGIN & REGISTER STATES ===
  const [isRegistering, setIsRegistering] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    userName: '',
    email: '',
    password: '',
    fullName: ''
  })

  // === REFS ===
  const selectedUserRef = useRef(null) 
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // === SYNC SELECTED USER REF ===
  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])

  // === AUTO SCROLL ===
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // === MARK AS READ ===
  const markAsRead = useCallback(async (targetUserId) => {
    if (!token) return
    try {
      await axios.post(`${API_URL}/chat/mark-read/${targetUserId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, unreadCount: 0 } : u
      ))
    } catch (error) {
      console.error("Mark read error:", error)
    }
  }, [token])

  // === LOAD USERS ===
  const loadUsers = useCallback(async (activeToken) => {
    try {
      const { data } = await axios.get(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      })
      const userList = Array.isArray(data) ? data : (data.data || [])
      setUsers(userList) 
    } catch (error) {
      console.error('Load users error:', error)
      if (error.response?.status === 401) logout()
    }
  }, [])

  // === LOAD MESSAGES ===
  const loadMessages = useCallback(async (userId) => {
    if (!token) return
    try {
      const convResponse = await axios.post(`${API_URL}/chat/conversation/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      let conversationId = convResponse.data
      if (typeof conversationId === 'object') {
        conversationId = conversationId.value || conversationId.id
      }

      if (!conversationId) throw new Error("Conversation ID not found")

      const msgResponse = await axios.get(`${API_URL}/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const messageList = Array.isArray(msgResponse.data) ? msgResponse.data : (msgResponse.data.data || [])
      const sortedMessages = messageList.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))
      setMessages(sortedMessages)
    } catch (error) {
      console.error("Load messages error:", error)
      setMessages([])
    }
  }, [token])

  // === SIGNALR CONNECTION ===
  useEffect(() => {
    if (!token) return

    let isMounted = true
    let newConnection = null

    const setupSignalR = async () => {
      loadUsers(token)

      newConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, { 
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets,
        // Ngrok için eklenen kısım:
        headers: { "ngrok-skip-browser-warning": "true" } 
      })
      .withAutomaticReconnect()
      .build()

      try {
        await newConnection.start()
        console.log("✅ SignalR Connected")
        if (isMounted) setConnection(newConnection)

        // === RECEIVE MESSAGE ===
        newConnection.on('ReceiveMessage', (message) => {
          const currentUser = JSON.parse(localStorage.getItem('user'))
          const isMyMessage = message.senderId === currentUser?.id
          const isFromSelectedUser = selectedUserRef.current?.id === message.senderId

          console.log('📨 Message received:', { 
            messageId: message.id, 
            senderId: message.senderId, 
            currentUserId: currentUser?.id, 
            isMyMessage 
          })

          // Auto-mark as read if message is from selected user
          if (!isMyMessage && isFromSelectedUser) {
            markAsRead(message.senderId)
          }

          // Add message to chat if it's mine or from selected user
          if (isMyMessage || isFromSelectedUser) {
            setMessages(prev => {
              // Optimistic update'i değiştir veya yeni mesaj ekle
              const tempIndex = prev.findIndex(m => m.id.startsWith('temp-') && m.content === message.content)
              if (tempIndex !== -1 && isMyMessage) {
                // Temporary mesajı gerçek mesajla değiştir
                const newMessages = [...prev]
                newMessages[tempIndex] = message
                return newMessages
              }
              
              // Duplicate kontrolü
              if (prev.some(m => m.id === message.id)) return prev
              
              return [...prev, message]
            })
          }

          // Update user list
          setUsers(prevUsers => {
            const userIndex = prevUsers.findIndex(u => 
              u.id === (isMyMessage ? message.receiverId : message.senderId)
            )

            if (userIndex === -1) return prevUsers

            const updatedUser = { ...prevUsers[userIndex], lastMessageAt: new Date() }

            // Increment unread count if not from selected user
            if (!isMyMessage && !isFromSelectedUser) {
              updatedUser.unreadCount = (updatedUser.unreadCount || 0) + 1
            }

            const newUsers = [...prevUsers]
            newUsers.splice(userIndex, 1)
            return [updatedUser, ...newUsers]
          })
        })

        // === MESSAGES READ ===
        newConnection.on('MessagesRead', () => {
          setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })))
        })
        
        // === USER ONLINE STATUS ===
        newConnection.on('UserOnline', (userId) => {
          console.log(`👤 User ${userId} is now online`)
          setUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, isOnline: true } : u
          ))
          setSelectedUser(prev => 
            prev?.id === userId ? { ...prev, isOnline: true } : prev
          )
        })

        newConnection.on('UserOffline', (userId) => {
          console.log(`👤 User ${userId} is now offline`)
          setUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, isOnline: false } : u
          ))
          setSelectedUser(prev => 
            prev?.id === userId ? { ...prev, isOnline: false } : prev
          )
        })
        
        // === ERROR MESSAGE ===
        newConnection.on('ErrorMessage', (errorMsg) => {
          console.error("Backend Error:", errorMsg)
          alert(errorMsg)
        })

      } catch (err) {
        console.error('❌ SignalR Connection Error:', err)
      }
    }

    setupSignalR()

    return () => {
      isMounted = false
      if (newConnection) {
        newConnection.off('ReceiveMessage')
        newConnection.off('MessagesRead')
        newConnection.off('UserOnline')
        newConnection.off('UserOffline')
        newConnection.off('ErrorMessage')
        newConnection.stop()
      }
    }
  }, [token, loadUsers, markAsRead])

  // === SELECT USER ===
  const handleSelectUser = useCallback((u) => {
    setSelectedUser(u)
    markAsRead(u.id)
  }, [markAsRead])

  // === LOAD MESSAGES WHEN USER SELECTED ===
  useEffect(() => {
    if (selectedUser?.id && token) {
      loadMessages(selectedUser.id)
    }
  }, [selectedUser?.id, token, loadMessages])

  // === SEND MESSAGE ===
  const sendMessage = async (e) => {
    e.preventDefault()
    
    console.log('🚀 Send message attempt:', { 
      hasMessage: !!messageInput.trim(), 
      hasFile: !!selectedFile, 
      hasSelectedUser: !!selectedUser, 
      hasConnection: !!connection 
    })

    if ((!messageInput.trim() && !selectedFile) || !selectedUser || !connection) {
      console.warn('⚠️ Cannot send: missing requirements')
      return
    }

    let currentUser = user
    if (!currentUser) {
      try {
        const storedUser = localStorage.getItem('user')
        console.log('📦 Stored user string:', storedUser)
        currentUser = storedUser ? JSON.parse(storedUser) : null
      } catch (err) {
        console.error('❌ Failed to parse user from localStorage:', err)
      }
    }
    
    console.log('👤 Current user:', currentUser)

    if (!currentUser?.id) {
      console.error('❌ No user ID found. User object:', currentUser)
      alert('User session expired. Please login again.')
      logout()
      return
    }

    const content = messageInput.trim()
    let attachmentData = null

    try {
      // Upload file if exists
      if (selectedFile) {
        console.log('📎 Uploading file...')
        const formData = new FormData()
        formData.append('file', selectedFile)

        const { data } = await axios.post(`${API_URL}/files/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        })

        console.log('✅ File uploaded:', data)

        attachmentData = {
          fileName: data.fileName,
          fileUrl: data.url,
          fileSize: data.fileSize,
          mimeType: data.contentType,
          type: selectedFile.type.startsWith('image/') ? 1 : 4
        }
      }

      // Optimistic UI Update - mesajı hemen ekrana ekle
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        content: content,
        senderId: currentUser.id,
        receiverId: selectedUser.id,
        sentAt: new Date().toISOString(),
        isRead: false,
        attachments: attachmentData ? [{
          id: `temp-att-${Date.now()}`,
          fileName: attachmentData.fileName,
          fileUrl: attachmentData.fileUrl,
          fileSize: attachmentData.fileSize,
          type: attachmentData.type
        }] : []
      }

      console.log('📝 Adding optimistic message:', optimisticMessage)
      setMessages(prev => [...prev, optimisticMessage])

      // Update user list - son mesaj zamanını güncelle
      setUsers(prev => {
        const userIndex = prev.findIndex(u => u.id === selectedUser.id)
        if (userIndex === -1) return prev
        
        const updatedUser = { ...prev[userIndex], lastMessageAt: new Date() }
        const newUsers = [...prev]
        newUsers.splice(userIndex, 1)
        return [updatedUser, ...newUsers]
      })

      // Clear inputs
      setMessageInput('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Send message via SignalR
      const messagePayload = { 
        receiverId: selectedUser.id, 
        content: content || null,
        attachment: attachmentData, 
        type: attachmentData ? (attachmentData.type === 1 ? 2 : 5) : 1
      }
      
      console.log('📤 Sending via SignalR:', messagePayload)
      await connection.invoke('SendMessage', messagePayload)
      console.log('✅ Message sent successfully')

    } catch (err) {
      console.error("❌ Send message error:", err)
      console.error("Error details:", err.response?.data || err.message)
      alert("Failed to send message: " + (err.response?.data?.message || err.message))
      // Hata durumunda optimistic mesajı geri al
      setMessages(prev => prev.filter(m => !m.id.toString().startsWith('temp-')))
    }
  }

  // === AUTH SUCCESS HANDLER ===
  const handleAuthSuccess = (responseData) => {
    console.log('🔐 Auth success response:', responseData)
    
    // Token'ı farklı lokasyonlardan bulmaya çalış
    const receivedToken = responseData.token || 
                          responseData.data?.token || 
                          responseData.accessToken || 
                          responseData.data?.accessToken
    
    if (!receivedToken) {
      console.error('❌ No token in response')
      alert("Login successful but no token received")
      return
    }

    // User ID'yi farklı lokasyonlardan bulmaya çalış (userId backend'de kullanılıyor)
    const userId = responseData.userId ||           // ✅ Backend bu kullanıyor
                   responseData.id || 
                   responseData.data?.userId || 
                   responseData.data?.id || 
                   responseData.user?.id

    const userName = responseData.userName || 
                     responseData.data?.userName || 
                     responseData.user?.userName

    const fullName = responseData.fullName || 
                     responseData.data?.fullName || 
                     responseData.user?.fullName ||
                     userName  // fullName yoksa userName kullan

    const email = responseData.email || 
                  responseData.data?.email || 
                  responseData.user?.email

    const userData = {
      id: userId,
      userName: userName,
      fullName: fullName,
      email: email
    }

    console.log('👤 Extracted user data:', userData)

    if (!userData.id) {
      console.error('❌ No user ID in response. Available keys:', Object.keys(responseData))
      if (responseData.data) {
        console.error('Data keys:', Object.keys(responseData.data))
      }
      alert("Login successful but no user ID received. Please check backend response format.")
      return
    }

    localStorage.setItem('token', receivedToken)
    localStorage.setItem('user', JSON.stringify(userData))
    
    console.log('✅ Saved to localStorage')
    console.log('📦 Token:', receivedToken)
    console.log('📦 User:', JSON.parse(localStorage.getItem('user')))
    
    setToken(receivedToken)
    setUser(userData)
  }

  // === LOGIN ===
  const login = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, loginForm)
      console.log('🔍 Full login response:', data)
      console.log('🔍 Response structure:', {
        hasToken: !!data.token,
        hasData: !!data.data,
        hasId: !!data.id,
        dataHasToken: !!data.data?.token,
        dataHasId: !!data.data?.id,
        fullStructure: JSON.stringify(data, null, 2)
      })
      handleAuthSuccess(data)
    } catch (error) {
      console.error('Login error:', error)
      alert('Login failed: ' + (error.response?.data?.message || 'Please try again'))
    }
  }

  // === REGISTER ===
  const register = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, registerForm)
      console.log('🔍 Full register response:', data)
      console.log('🔍 Response structure:', {
        hasToken: !!data.token,
        hasData: !!data.data,
        hasId: !!data.id,
        dataHasToken: !!data.data?.token,
        dataHasId: !!data.data?.id,
        fullStructure: JSON.stringify(data, null, 2)
      })
      handleAuthSuccess(data)
    } catch (error) {
      console.error('Register error:', error)
      alert('Registration failed: ' + (error.response?.data?.message || 'Please try again'))
    }
  }

  // === LOGOUT ===
  const logout = () => {
    localStorage.clear()
    setToken(null)
    setUser(null)
    setMessages([])
    setSelectedUser(null)
    setUsers([])
    if (connection) connection.stop()
  }

  // === LOGIN/REGISTER SCREEN ===
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
          <form onSubmit={isRegistering ? register : login}>
            {isRegistering ? (
              <>
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={registerForm.userName} 
                  onChange={e => setRegisterForm(prev => ({ ...prev, userName: e.target.value }))} 
                  required 
                />
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={registerForm.fullName} 
                  onChange={e => setRegisterForm(prev => ({ ...prev, fullName: e.target.value }))} 
                />
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={registerForm.email} 
                  onChange={e => setRegisterForm(prev => ({ ...prev, email: e.target.value }))} 
                  required 
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={registerForm.password} 
                  onChange={e => setRegisterForm(prev => ({ ...prev, password: e.target.value }))} 
                  required 
                />
              </>
            ) : (
              <>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={loginForm.email} 
                  onChange={e => setLoginForm(prev => ({ ...prev, email: e.target.value }))} 
                  required 
                />
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={loginForm.password} 
                  onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))} 
                  required 
                />
              </>
            )}
            <button type="submit">{isRegistering ? 'Sign Up' : 'Sign In'}</button>
            <p onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
            </p>
          </form>
        </div>
      </div>
    )
  }

  // === MAIN CHAT INTERFACE ===
  return (
    <div className="container">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Chatter</h3>
          <div className="user-profile-summary">
            <small>{user?.fullName || user?.userName}</small>
          </div>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
        
        <div className="user-list">
          {users.length === 0 ? (
            <p style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>
              No users found
            </p>
          ) : (
            users
              .filter(u => u.id !== user?.id)
              .map(u => (
                <div 
                  key={u.id} 
                  className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                  onClick={() => handleSelectUser(u)}
                >
                  <div className="user-avatar">
                    {(u.fullName?.[0] || u.userName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="user-row">
                    <div className="user-info">
                      <span className="user-name">{u.fullName || u.userName}</span>
                      {u.isOnline && <span className="online-dot" title="Online" />}
                    </div>
                    {u.unreadCount > 0 && (
                      <div className="notification-badge">{u.unreadCount}</div>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
      
      {/* CHAT AREA */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* CHAT HEADER */}
            <div className="chat-header">
              <h3>{selectedUser.fullName || selectedUser.userName}</h3>
              {selectedUser.isOnline && (
                <span style={{ color: '#10b981', fontSize: '0.8rem', marginLeft: 10 }}>
                  ● Online
                </span>
              )}
            </div>
            
            {/* MESSAGES */}
            <div className="messages">
              {messages.map((msg, i) => (
                <div 
                  key={msg.id || i} 
                  className={`message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
                >
                  <div className="msg-bubble">
                    {/* ATTACHMENTS */}
                    {msg.attachments?.map(att => (
                      <div key={att.id} style={{ marginBottom: 10 }}>
                        {att.type === 1 ? (
                          <img 
                            src={`${API_URL.replace('/api', '')}${att.fileUrl}`} 
                            alt={att.fileName}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '300px',
                              borderRadius: 12,
                              objectFit: 'cover',
                              cursor: 'pointer'
                            }}
                            onClick={() => window.open(`http://localhost:5157${att.fileUrl}`, '_blank')}
                          />
                        ) : (
                          <a 
                            href={`http://localhost:5157${att.fileUrl}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="file-attachment"
                          >
                            📄 {att.fileName}
                          </a>
                        )}
                      </div>
                    ))}
                    {/* MESSAGE CONTENT */}
                    {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                  </div>
                  
                  {/* MESSAGE TIME */}
                  <div className="msg-time">
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.senderId === user?.id && (
                      <span style={{ 
                        marginLeft: 5, 
                        fontSize: '0.8rem', 
                        color: msg.isRead ? '#4ade80' : '#94a3b8' 
                      }}>
                        {msg.isRead ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <form className="input-area" onSubmit={sendMessage}>
              {selectedFile && (
                <div className="file-preview">
                  <span>📎 {selectedFile.name}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                className="attach-btn"
                title="Attach file"
              >
                📎
              </button>

              <input 
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                placeholder="Write a message..."
                autoFocus
              />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div className="no-chat">
            <div className="no-chat-content">
              <h2>Select a Conversation</h2>
              <p>Choose a contact from the sidebar to start messaging.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App