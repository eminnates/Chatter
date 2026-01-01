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
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [selectedFile, setSelectedFile] = useState(null)
  const [toast, setToast] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState(null)
  
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
  const userRef = useRef(user)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageInputRef = useRef(null)
  const loginEmailRef = useRef(null)
  const registerUsernameRef = useRef(null)

  // === TOAST NOTIFICATION ===
  const showToast = useCallback((message, type = 'info') => {
    let displayMessage = message
    if (message.length > 150) {
      displayMessage = message.substring(0, 150) + '...'
    }
    setToast({ message: displayMessage, type })
  }, [])

  // === SYNC SELECTED USER REF ===
  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])
  useEffect(() => {
  userRef.current = user // User değiştikçe Ref'i güncelle
  }, [user])

  // === AUTO SCROLL ===
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // === AUTO HIDE TOAST ===
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // === AUTO FOCUS ON PAGE CHANGE ===
  useEffect(() => {
    if (!token) {
      setTimeout(() => {
        if (isRegistering) {
          registerUsernameRef.current?.focus()
        } else {
          loginEmailRef.current?.focus()
        }
      }, 100)
    }
  }, [token, isRegistering])

  // === AUTO FOCUS WHEN USER SELECTED ===
  useEffect(() => {
    if (selectedUser && messageInputRef.current) {
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 100)
    }
  }, [selectedUser])

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
  const loadUsers = useCallback(async (activeToken, retryCount = 0) => {
    try {
      const { data } = await axios.get(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      })
      const userList = Array.isArray(data) ? data : (data.data || [])
      setUsers(userList) 
    } catch (error) {
      console.error('Load users error:', error)
      if (error.response?.status === 401) {
        logout()
      } else if (retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000)
        console.log(`Retrying loadUsers in ${delay}ms...`)
        setTimeout(() => loadUsers(activeToken, retryCount + 1), delay)
      } else {
        showToast('Failed to load users. Please refresh.', 'error')
      }
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
      setConnectionStatus('connecting')
      loadUsers(token)

      newConnection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { 
          accessTokenFactory: () => token,
          transport: signalR.HttpTransportType.WebSockets,
          headers: { "ngrok-skip-browser-warning": "true" } 
        })
        .withAutomaticReconnect()
        .build()

      try {
        await newConnection.start()
        console.log("✅ SignalR Connected")
        if (isMounted) {
          setConnection(newConnection)
          setConnectionStatus('connected')
        }

        // === RECEIVE MESSAGE ===
      newConnection.on('ReceiveMessage', (message) => {
        // 1. Backend'den hangi formatta (senderId/SenderId) gelirse gelsin veriyi al
        const senderId = message.senderId || message.SenderId;
        const receiverId = message.receiverId || message.ReceiverId;
        const content = message.content || message.Content;

        const incomingSenderId = senderId?.toLowerCase();
        const currentUserId = userRef.current?.id?.toLowerCase(); // Ref kullanıyoruz
        const selectedUserId = selectedUserRef.current?.id?.toLowerCase();

        const isMyMessage = incomingSenderId === currentUserId;
        const isFromSelectedUser = incomingSenderId === selectedUserId;

        console.log('📨 SignalR Test:', { 
          incomingSenderId, 
          currentUserId, 
          selectedUserId,
          isMyMessage,
          isFromSelectedUser 
        });

        if (isMyMessage || isFromSelectedUser) {
          setMessages(prev => {
            // Mesaj zaten listede var mı? (Duplicate engelleme)
            if (prev.some(m => m.id === message.id)) return prev;

            // Optimistic Update: Geçici mesajı bul ve gerçek olanla değiştir
            const tempIndex = prev.findIndex(m => 
              m.id.toString().startsWith('temp-') && m.content === content
            );

            if (tempIndex !== -1 && isMyMessage) {
              const updated = [...prev];
              updated[tempIndex] = message;
              return updated;
            }

            return [...prev, message];
          });

          if (isFromSelectedUser && !isMyMessage) {
            markAsRead(senderId);
            setIsTyping(false);
          }
        }

        // Sidebar Güncelleme
        setUsers(prevUsers => {
          const targetId = isMyMessage ? receiverId?.toLowerCase() : incomingSenderId;
          const userIndex = prevUsers.findIndex(u => u.id?.toLowerCase() === targetId);
          
          if (userIndex === -1) return prevUsers;

          const updatedUser = { 
            ...prevUsers[userIndex], 
            lastMessageAt: new Date(),
            unreadCount: (!isMyMessage && !isFromSelectedUser) 
              ? (prevUsers[userIndex].unreadCount || 0) + 1 
              : prevUsers[userIndex].unreadCount
          };

          const newUsers = [...prevUsers];
          newUsers.splice(userIndex, 1);
          return [updatedUser, ...newUsers];
        });
      });

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

        // === USER TYPING ===
        newConnection.on('UserTyping', (userId) => {
          console.log(`⌨️ User ${userId} is typing`)
          if (selectedUserRef.current?.id === userId) {
            setIsTyping(true)
            if (typingTimeout) clearTimeout(typingTimeout)
            const timeout = setTimeout(() => setIsTyping(false), 3000)
            setTypingTimeout(timeout)
          }
        })

        newConnection.on('UserStoppedTyping', (userId) => {
          console.log(`⌨️ User ${userId} stopped typing`)
          if (selectedUserRef.current?.id === userId) {
            setIsTyping(false)
            if (typingTimeout) clearTimeout(typingTimeout)
          }
        })
        
        // === ERROR MESSAGE ===
        newConnection.on('ErrorMessage', (errorMsg) => {
          console.error("Backend Error:", errorMsg)
          showToast(errorMsg, 'error')
        })

      } catch (err) {
        console.error('❌ SignalR Connection Error:', err)
        if (isMounted) {
          setConnectionStatus('failed')
          showToast('Connection failed. Retrying...', 'error')
        }
      }
    }

    setupSignalR()

    return () => {
      isMounted = false
      setConnectionStatus('disconnected')
      if (newConnection) {
        newConnection.off('ReceiveMessage')
        newConnection.off('MessagesRead')
        newConnection.off('UserOnline')
        newConnection.off('UserOffline')
        newConnection.off('UserTyping')
        newConnection.off('UserStoppedTyping')
        newConnection.off('ErrorMessage')
        newConnection.stop().catch(err => console.error('SignalR stop error:', err))
      }
      if (typingTimeout) clearTimeout(typingTimeout)
    }
  }, [token, loadUsers, markAsRead, showToast])

  // === SELECT USER ===
  const handleSelectUser = useCallback((u) => {
    setSelectedUser(u)
    setIsTyping(false)
    markAsRead(u.id)
  }, [markAsRead])

  // === LOAD MESSAGES WHEN USER SELECTED ===
  useEffect(() => {
    if (selectedUser?.id && token) {
      loadMessages(selectedUser.id)
    }
  }, [selectedUser?.id, token, loadMessages])

  // === HANDLE TYPING ===
  const handleTyping = useCallback(() => {
    if (!connection || !selectedUser) return
    try {
      connection.invoke('NotifyTyping', selectedUser.id)
    } catch (err) {
      console.error('Typing notification error:', err)
    }
  }, [connection, selectedUser])

  useEffect(() => {
    if (messageInput && selectedUser && connection) {
      handleTyping()
    }
  }, [messageInput, selectedUser, connection, handleTyping])

  // === SEND MESSAGE ===
  const sendMessage = async (e) => {
    e.preventDefault()
    
    if ((!messageInput.trim() && !selectedFile) || !selectedUser || !connection || connectionStatus !== 'connected') {
      if (connectionStatus !== 'connected') {
        showToast('Connection lost. Please wait...', 'error')
      }
      return
    }

    let currentUser = user
    if (!currentUser) {
      try {
        const storedUser = localStorage.getItem('user')
        currentUser = storedUser ? JSON.parse(storedUser) : null
      } catch (err) {
        console.error('❌ Failed to parse user from localStorage:', err)
      }
    }

    if (!currentUser?.id) {
      console.error('❌ No user ID found')
      showToast('Session expired. Please login again.', 'error')
      logout()
      return
    }

    const content = messageInput.trim()
    let attachmentData = null

    try {
      if (selectedFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)

        const { data } = await axios.post(`${API_URL}/files/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        })

        attachmentData = {
          fileName: data.fileName,
          fileUrl: data.url,
          fileSize: data.fileSize,
          mimeType: data.contentType,
          type: selectedFile.type.startsWith('image/') ? 1 : 4
        }
      }

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

      setMessages(prev => [...prev, optimisticMessage])

      setUsers(prev => {
        const userIndex = prev.findIndex(u => u.id === selectedUser.id)
        if (userIndex === -1) return prev
        const updatedUser = { ...prev[userIndex], lastMessageAt: new Date() }
        const newUsers = [...prev]
        newUsers.splice(userIndex, 1)
        return [updatedUser, ...newUsers]
      })

      setMessageInput('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      const messagePayload = { 
        receiverId: selectedUser.id, 
        content: content || null,
        attachment: attachmentData, 
        type: attachmentData ? (attachmentData.type === 1 ? 2 : 5) : 1
      }
      
      await connection.invoke('SendMessage', messagePayload)

    } catch (err) {
      console.error("❌ Send message error:", err)
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.title ||
                          err.message ||
                          'Failed to send message'
      showToast(errorMessage, 'error')
      setMessages(prev => prev.filter(m => !m.id.toString().startsWith('temp-')))
    }
  }

  // === AUTH SUCCESS HANDLER ===
  const handleAuthSuccess = (responseData) => {
    const receivedToken = responseData.token || 
                          responseData.data?.token || 
                          responseData.accessToken || 
                          responseData.data?.accessToken
    
    if (!receivedToken) {
      showToast('Login successful but no token received', 'error')
      return
    }

    const userId = responseData.userId ||
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
                     userName

    const email = responseData.email || 
                  responseData.data?.email || 
                  responseData.user?.email

    const userData = { id: userId, userName: userName, fullName: fullName, email: email }

    if (!userData.id) {
      showToast('Login successful but user data is incomplete', 'error')
      return
    }

    localStorage.setItem('token', receivedToken)
    localStorage.setItem('user', JSON.stringify(userData))
    setToken(receivedToken)
    setUser(userData)
  }

  // === LOGIN ===
  const login = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, loginForm)
      handleAuthSuccess(data)
      showToast('Welcome back!', 'success')
    } catch (error) {
      const errorData = error.response?.data
      let errorMessage = 'Invalid email or password. Please try again.'
      
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message
      } else if (errorData?.errors) {
        const allErrors = []
        Object.entries(errorData.errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach(msg => allErrors.push(msg))
          } else {
            allErrors.push(messages)
          }
        })
        if (allErrors.length > 0) {
          errorMessage = allErrors.length === 1 ? allErrors[0] : `${allErrors[0]} and ${allErrors.length - 1} more error${allErrors.length > 2 ? 's' : ''}`
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message
      } else if (errorData?.title && errorData.title !== 'One or more validation errors occurred.') {
        errorMessage = errorData.title
      }
      
      showToast(errorMessage, 'error')
    }
  }

  // === REGISTER ===
  const register = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post(`${API_URL}/auth/register`, registerForm)
      
      if (!data.token && !data.data?.token && !data.accessToken) {
        showToast('Account created! Logging you in...', 'success')
        try {
          const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            email: registerForm.email,
            password: registerForm.password
          })
          handleAuthSuccess(loginResponse.data)
          showToast('Welcome to Chatter!', 'success')
        } catch (loginError) {
          showToast('Account created! Please login with your credentials.', 'success')
          setIsRegistering(false)
        }
      } else {
        handleAuthSuccess(data)
        showToast('Welcome to Chatter!', 'success')
      }
    } catch (error) {
      const errorData = error.response?.data
      let errorMessage = 'Registration failed. Please try again.'
      
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message
      } else if (errorData?.errors) {
        const allErrors = []
        Object.entries(errorData.errors).forEach(([field, messages]) => {
          if (Array.isArray(messages)) {
            messages.forEach(msg => allErrors.push(msg))
          } else {
            allErrors.push(messages)
          }
        })
        if (allErrors.length > 0) {
          errorMessage = allErrors.length === 1 ? allErrors[0] : `${allErrors[0]} and ${allErrors.length - 1} more error${allErrors.length > 2 ? 's' : ''}`
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message
      } else if (errorData?.title) {
        errorMessage = errorData.title
      }
      
      showToast(errorMessage, 'error')
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
    setConnectionStatus('disconnected')
    if (connection) {
      connection.stop().catch(err => console.error('Logout connection stop error:', err))
    }
  }

  // === LOGIN/REGISTER SCREEN ===
  if (!token) {
    return (
      <div className="login-container">
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'ℹ'}
            </div>
            <span>{toast.message}</span>
          </div>
        )}

        <div className="login-box">
          <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
          <form onSubmit={isRegistering ? register : login}>
            {isRegistering ? (
              <>
                <input 
                  ref={registerUsernameRef}
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
                  ref={loginEmailRef}
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
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'info' && 'ℹ'}
          </div>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Chatter</h3>
          <div className="user-profile-summary">
            <small>{user?.fullName || user?.userName}</small>
            {connectionStatus === 'connecting' && (
              <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>● Connecting...</span>
            )}
            {connectionStatus === 'failed' && (
              <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>● Disconnected</span>
            )}
          </div>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
        
        <div className="user-list">
          {users.length === 0 ? (
            <p style={{ padding: 20, color: '#94a3b8', textAlign: 'center' }}>
              {connectionStatus === 'connecting' ? 'Loading users...' : 'No users found'}
            </p>
          ) : (
            users.filter(u => u.id !== user?.id).map(u => (
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
      
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>{selectedUser.fullName || selectedUser.userName}</h3>
              {selectedUser.isOnline && (
                <span style={{ color: '#10b981', fontSize: '0.8rem', marginLeft: 10 }}>● Online</span>
              )}
            </div>
            
            <div className="messages">
              {messages.map((msg, i) => (
                <div 
                  key={msg.id || i} 
                  className={`message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
                >
                  <div className="msg-bubble">
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
                            onClick={() => window.open(`${API_URL.replace('/api', '')}${att.fileUrl}`, '_blank')}
                          />
                        ) : (
                          <a 
                            href={`${API_URL.replace('/api', '')}${att.fileUrl}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="file-attachment"
                          >
                            📄 {att.fileName}
                          </a>
                        )}
                      </div>
                    ))}
                    {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                  </div>
                  
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

              {isTyping && (
                <div className="typing-indicator">
                  <div className="typing-bubble">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

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
                ref={messageInputRef}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                placeholder="Write a message..."
                disabled={connectionStatus !== 'connected'}
              />
              <button type="submit" disabled={connectionStatus !== 'connected'}>
                {connectionStatus === 'connecting' ? '...' : 'Send'}
              </button>
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