import { useState, useEffect, useRef, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'
import { useWebRTC } from './hooks/useWebRTC'
import IncomingCallModal from './components/IncomingCallModal'
import ActiveCallScreen from './components/ActiveCallScreen'
import ProfilePage from './components/ProfilePage'
import SettingsPage from './components/SettingsPage'
import { getApiUrl, getHubUrl, getConfig } from './utils/config'
import { 
  CheckCircle2, XCircle, Info, Phone, Video, 
  Check, CheckCheck, Paperclip, X, File, LogOut, User, Settings, Menu 
} from 'lucide-react'

// Initialize axios defaults
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
  const [showProfilePage, setShowProfilePage] = useState(false)
  const [viewProfileUserId, setViewProfileUserId] = useState(null)
  const [showSettingsPage, setShowSettingsPage] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  
  // === CONFIG STATES ===
  // Store base URL in state (without /api), we'll add /api in API calls
  const [apiUrl, setApiUrl] = useState('')
  const [hubUrl, setHubUrl] = useState('')
  const [configLoaded, setConfigLoaded] = useState(false)
  
  // Helper to get full API URL with /api prefix
  const getFullApiUrl = useCallback(() => {
    if (!apiUrl) return ''
    const base = apiUrl.replace(/\/+$/, '')
    return base + '/api'
  }, [apiUrl])
  
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
  const usersRef = useRef(users)
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

  // === NOTIFICATION FUNCTIONS ===
  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const showNotification = useCallback((title, body, icon) => {
    // Check if notifications are supported and permitted
    if (!('Notification' in window)) return
    
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: icon || '/icon.png',
        badge: '/icon.png',
        tag: 'chatter-notification',
        requireInteraction: false
      })
      
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
      
      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000)
    } else if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission()
  }, [requestNotificationPermission])

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // === WEBRTC HOOK ===
  const {
    localStream,
    remoteStream,
    callStatus,
    activeCall,
    initiateCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo
  } = useWebRTC(connection, user?.id, showToast, showNotification)

  // === CALL HANDLERS ===
  const handleInitiateCall = useCallback((receiverId, callType) => {
    // Prevent calling yourself
    if (receiverId === user?.id) {
      showToast('You cannot call yourself.', 'error')
      return
    }
    
    if (activeCall && (callStatus === 'active' || callStatus === 'ringing')) {
      showToast('You are already in an active call.', 'error')
      return
    }
    initiateCall(receiverId, callType)
  }, [activeCall, callStatus, initiateCall, showToast, user?.id])

  // === SYNC SELECTED USER REF ===
  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])
  useEffect(() => {
    userRef.current = user // User değiştikçe Ref'i güncelle
  }, [user])
  useEffect(() => {
    usersRef.current = users // Users değiştikçe Ref'i güncelle
  }, [users])

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

  // === CONFIG CHANGE HANDLER ===
  const handleConfigChange = useCallback((newConfig) => {
    // newConfig.apiUrl is base URL (without /api), getApiUrl will add /api automatically
    // But we need to store base URL in state, so getApiUrl can add /api when needed
    setApiUrl(newConfig.apiUrl)
    setHubUrl(newConfig.hubUrl)
    
    // Disconnect current connection if exists
    if (connection) {
      connection.stop()
      setConnection(null)
      setConnectionStatus('disconnected')
    }
    
    // If user is logged in, reconnect
    if (token) {
      setTimeout(() => {
        // Connection will be re-established by useEffect
      }, 500)
    }
  }, [connection, token])

  // === LOAD CONFIG ON MOUNT (synchronous) ===
  useEffect(() => {
    const config = getConfig()
    console.log('📱 Loading config from localStorage:', config)
    
    if (config.apiUrl) {
      const baseUrl = config.apiUrl.replace(/\/api\/?$/, '')
      setApiUrl(baseUrl)
      console.log('✅ API URL loaded:', baseUrl)
    }
    
    if (config.hubUrl) {
      setHubUrl(config.hubUrl)
      console.log('✅ Hub URL loaded:', config.hubUrl)
    } else if (config.apiUrl) {
      // Auto-detect hub URL if not set
      const baseUrl = config.apiUrl.replace(/\/api\/?$/, '')
      const autoHub = baseUrl + '/hubs/chat'
      setHubUrl(autoHub)
      console.log('✅ Hub URL auto-detected:', autoHub)
    }
    
    setConfigLoaded(true)
  }, [])

  // === MARK AS READ ===
  const markAsRead = useCallback(async (targetUserId) => {
    if (!token || !apiUrl) return
    try {
      await axios.post(`${getFullApiUrl()}/chat/mark-read/${targetUserId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(prev => prev.map(u => 
        u.id === targetUserId ? { ...u, unreadCount: 0 } : u
      ))
    } catch (error) {
      console.error("Mark read error:", error)
    }
  }, [token, getFullApiUrl])

  // === LOAD USERS ===
  const loadUsers = useCallback(async (activeToken, retryCount = 0) => {
    if (!apiUrl) {
      showToast('Backend URL yapılandırılmamış. Lütfen ayarlardan yapılandırın.', 'error')
      return
    }
    try {
      const { data } = await axios.get(`${getFullApiUrl()}/user`, {
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
  }, [getFullApiUrl, showToast, apiUrl])

  // === LOAD MESSAGES ===
  const loadMessages = useCallback(async (userId) => {
    if (!token || !apiUrl) return
    try {
      const convResponse = await axios.post(`${getFullApiUrl()}/chat/conversation/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      let conversationId = convResponse.data
      if (typeof conversationId === 'object') {
        conversationId = conversationId.value || conversationId.id
      }

      if (!conversationId) throw new Error("Conversation ID not found")

      const msgResponse = await axios.get(`${getFullApiUrl()}/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      const messageList = Array.isArray(msgResponse.data) ? msgResponse.data : (msgResponse.data.data || [])
      const sortedMessages = messageList.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))
      setMessages(sortedMessages)
    } catch (error) {
      console.error("Load messages error:", error)
      setMessages([])
    }
  }, [token, getFullApiUrl, apiUrl])

  // === SIGNALR CONNECTION ===
  useEffect(() => {
    if (!token) {
      // Clean up connection when logged out
      if (connection) {
        connection.stop()
        setConnection(null)
        setConnectionStatus('disconnected')
      }
      return
    }
    
    if (!hubUrl || !apiUrl) {
      console.warn('⚠️ Cannot connect to SignalR: missing hubUrl or apiUrl', { hubUrl, apiUrl })
      setConnectionStatus('failed')
      showToast('Backend URL yapılandırılmamış. Lütfen ayarlardan yapılandırın.', 'error')
      return
    }

    let isMounted = true
    let newConnection = null

    const setupSignalR = async () => {
      setConnectionStatus('connecting')
      loadUsers(token)

      newConnection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl, { 
          accessTokenFactory: () => token,
          transport: signalR.HttpTransportType.WebSockets,
          headers: { "ngrok-skip-browser-warning": "true" },
          skipNegotiation: true
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build()

      // Set keep-alive interval
      newConnection.keepAliveIntervalInMilliseconds = 15000 // 15 seconds
      newConnection.serverTimeoutInMilliseconds = 30000 // 30 seconds

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
        
        // Show notification for incoming messages (not from me)
        if (!isMyMessage) {
          // Show notification if:
          // 1. Message is from a different chat (not selected user)
          // 2. Message is from selected user BUT window is not focused
          if (!isFromSelectedUser || !document.hasFocus()) {
            // Find sender name from users list using ref for most up-to-date data
            const sender = usersRef.current.find(u => u.id?.toLowerCase() === incomingSenderId);
            const senderName = sender?.fullName || sender?.userName || message.senderName || 'Someone';
            const messagePreview = message.content?.substring(0, 50) || 'New message';
            showNotification(senderName, messagePreview);
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
  }, [token, hubUrl, apiUrl, loadUsers, markAsRead, showToast])

  // === SELECT USER ===
  const handleSelectUser = useCallback((u) => {
    setSelectedUser(u)
    setIsTyping(false)
    markAsRead(u.id)
    // Close mobile sidebar when user selected
    if (isMobile) {
      setIsMobileSidebarOpen(false)
    }
  }, [markAsRead, isMobile])

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

        const { data } = await axios.post(`${getFullApiUrl()}/files/upload`, formData, {
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
      if (!apiUrl) {
        showToast('Backend URL yapılandırılmamış. Lütfen ayarlardan yapılandırın.', 'error')
        setShowSettingsPage(true)
        return
      }
      
      const { data } = await axios.post(`${getFullApiUrl()}/auth/login`, loginForm)
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
      if (!apiUrl) {
        showToast('Backend URL yapılandırılmamış. Lütfen ayarlardan yapılandırın.', 'error')
        setShowSettingsPage(true)
        return
      }
      
      const { data } = await axios.post(`${getFullApiUrl()}/auth/register`, registerForm)
      
      if (!data.token && !data.data?.token && !data.accessToken) {
        showToast('Account created! Logging you in...', 'success')
        try {
          const loginResponse = await axios.post(`${getFullApiUrl()}/auth/login`, {
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
    // Show settings page if no API URL configured or if explicitly requested
    if (showSettingsPage || !apiUrl) {
      return (
        <div className="container">
          {toast && (
            <div className={`toast toast-${toast.type}`}>
              <div className="toast-icon">
                {toast.type === 'success' && <CheckCircle2 size={20} />}
                {toast.type === 'error' && <XCircle size={20} />}
                {toast.type === 'info' && <Info size={20} />}
              </div>
              <span>{toast.message}</span>
            </div>
          )}
          <SettingsPage
            onClose={() => {
              setShowSettingsPage(false)
              if (!apiUrl) {
                // Keep showing settings if still no API URL
                setTimeout(() => setShowSettingsPage(true), 100)
              }
            }}
            onConfigChange={handleConfigChange}
            showToast={showToast}
          />
        </div>
      )
    }
    
    return (
      <div className="login-container">
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            <div className="toast-icon">
              {toast.type === 'success' && <CheckCircle2 size={20} />}
              {toast.type === 'error' && <XCircle size={20} />}
              {toast.type === 'info' && <Info size={20} />}
            </div>
            <span>{toast.message}</span>
          </div>
        )}

        <div className="login-box">
          <div className="login-logo">
            <img src="/logo.png" alt="Chatter Logo" />
          </div>
          <button 
            type="button"
            onClick={() => setShowSettingsPage(true)} 
            className="login-settings-btn"
            title="Configure Backend URL"
          >
            <Settings size={18} />
          </button>
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

  // === CHECK CONFIG ON MOUNT ===
  useEffect(() => {
    if (!apiUrl && !token) {
      // Show settings page if no config and not logged in
      setShowSettingsPage(true)
    }
  }, [apiUrl, token])

  // === MAIN CHAT INTERFACE ===
  return (
    <div className="container">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' && <CheckCircle2 size={20} />}
            {toast.type === 'error' && <XCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
          </div>
          <span>{toast.message}</span>
        </div>
      )}
      
      {!apiUrl && (
        <div className="config-warning">
          <Info size={20} />
          <span>Backend URL yapılandırılmamış. Lütfen ayarlardan yapılandırın.</span>
          <button onClick={() => setShowSettingsPage(true)} className="config-warning-btn">
            Ayarlara Git
          </button>
        </div>
      )}

      <div className={`sidebar ${isMobile && !isMobileSidebarOpen ? 'mobile-hidden' : ''}`}>
        <div className="sidebar-header">
          <h3>Chatter</h3>
          <div className="user-profile-summary">
            <small>{user?.fullName || user?.userName}</small>
            {connectionStatus === 'connecting' && (
              <span className="connection-status connecting">
                <span className="status-dot"></span>
                Connecting...
              </span>
            )}
            {connectionStatus === 'failed' && (
              <span className="connection-status disconnected">
                <span className="status-dot"></span>
                Disconnected
              </span>
            )}
          </div>
          <div className="sidebar-header-actions">
            <button onClick={() => {
              setViewProfileUserId(null)
              setShowProfilePage(true)
            }} className="profile-btn">
              <User size={18} />
              <span>Profil</span>
            </button>
            <button onClick={() => setShowSettingsPage(true)} className="settings-btn">
              <Settings size={18} />
              <span>Ayarlar</span>
            </button>
            <button onClick={logout} className="logout-btn">
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
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
                onContextMenu={(e) => {
                  e.preventDefault()
                  setViewProfileUserId(u.id)
                  setShowProfilePage(true)
                }}
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
        {showProfilePage ? (
          <ProfilePage
            user={viewProfileUserId ? users.find(u => u.id === viewProfileUserId) || {} : user}
            userId={viewProfileUserId}
            currentUserId={user?.id}
            token={token}
            API_URL={apiUrl}
            onUpdate={(updatedUser) => {
              setUser(updatedUser)
              localStorage.setItem('user', JSON.stringify(updatedUser))
            }}
            onClose={() => {
              setShowProfilePage(false)
              setViewProfileUserId(null)
            }}
            showToast={showToast}
          />
        ) : selectedUser ? (
          <>
            <div className="chat-header">
              {isMobile && (
                <button 
                  className="mobile-menu-btn"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  title="Open Menu"
                >
                  <Menu size={24} />
                </button>
              )}
              <h3>{selectedUser.fullName || selectedUser.userName}</h3>
              {selectedUser.isOnline && (
                <span className="online-status">
                  <span className="status-dot online"></span>
                  Online
                </span>
              )}
              <div className="chat-header-actions">
                <button
                  onClick={() => {
                    setViewProfileUserId(selectedUser.id)
                    setShowProfilePage(true)
                  }}
                  className="profile-view-btn"
                  title="View Profile"
                >
                  <User size={18} />
                </button>
              </div>
              <div className="call-buttons">
                <button 
                  className="call-btn audio-call"
                  onClick={() => handleInitiateCall(selectedUser.id, 1)}
                  title="Voice Call"
                  disabled={callStatus === 'active' || callStatus === 'ringing'}
                >
                  <Phone size={20} />
                </button>
                <button 
                  className="call-btn video-call"
                  onClick={() => handleInitiateCall(selectedUser.id, 2)}
                  title="Video Call"
                  disabled={callStatus === 'active' || callStatus === 'ringing'}
                >
                  <Video size={20} />
                </button>
              </div>
            </div>
            
            <div className="messages">
              {messages.map((msg, i) => {
                // System message (call history)
                if (msg.type === 'System') {
                  const isDeclined = msg.content.includes('declined');
                  const isMissed = msg.content.includes('Missed');
                  const isNegative = isDeclined || isMissed;
                  
                  return (
                    <div key={msg.id || i} className="system-message">
                      <div className={`system-message-content ${isNegative ? 'negative' : ''}`}>
                        <span className="call-icon">
                          {msg.content.includes('Video') ? <Video size={16} /> : <Phone size={16} />}
                        </span>
                        <span className="call-text">{msg.content}</span>
                      </div>
                      <div className="system-message-time">
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }
                
                // Regular message
                return (
                  <div 
                    key={msg.id || i} 
                    className={`message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
                  >
                    <div className="msg-bubble">
                    {msg.attachments?.map(att => (
                      <div key={att.id} style={{ marginBottom: 10 }}>
                        {att.type === 'Image' || att.type === '1' || att.type === 1 ? (
                          <img 
                            src={`${apiUrl}${att.fileUrl}`} 
                            alt={att.fileName}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '300px',
                              borderRadius: 12,
                              objectFit: 'cover',
                              cursor: 'pointer'
                            }}
                            onClick={() => window.open(`${apiUrl}${att.fileUrl}`, '_blank')}
                          />
                        ) : (
                          <a 
                            href={`${apiUrl}${att.fileUrl}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="file-attachment"
                          >
                            <File size={18} />
                            <span>{att.fileName}</span>
                          </a>
                        )}
                      </div>
                    ))}
                    {msg.content && <p style={{ margin: 0 }}>{msg.content}</p>}
                  </div>
                  
                  <div className="msg-time">
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {msg.senderId === user?.id && (
                      <span className={`read-status ${msg.isRead ? 'read' : 'sent'}`}>
                        {msg.isRead ? <CheckCheck size={16} /> : <Check size={16} />}
                      </span>
                    )}
                  </div>
                </div>
                );
              })}

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
                  <Paperclip size={16} />
                  <span>{selectedFile.name}</span>
                  <button 
                    type="button" 
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                  >
                    <X size={16} />
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
                <Paperclip size={20} />
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
        ) : showProfilePage ? null : (
          <div className="no-chat">
            <div className="no-chat-content">
              <h2>Select a Conversation</h2>
              <p>Choose a contact from the sidebar to start messaging.</p>
            </div>
          </div>
        )}
      </div>

      {/* Incoming Call Modal - for receiver */}
      {callStatus === 'ringing' && activeCall && activeCall.initiatorId !== user?.id && (
        <IncomingCallModal 
          call={activeCall}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {/* Outgoing Call Screen - for initiator */}
      {callStatus === 'ringing' && activeCall && activeCall.initiatorId === user?.id && (
        <div className="incoming-call-overlay">
          <div className="incoming-call-modal">
            <div className="call-icon">
              {activeCall.type === 2 ? <Video size={48} /> : <Phone size={48} />}
            </div>
            <h2>Calling...</h2>
            <p className="caller-name">
              {users.find(u => activeCall.participantIds?.find(id => id !== user?.id) === u.id)?.fullName || 'User'}
            </p>
            <div className="call-buttons">
              <button className="decline-button" onClick={endCall}>
                <X size={20} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Screen */}
      {callStatus === 'active' && (
        <ActiveCallScreen 
          localStream={localStream}
          remoteStream={remoteStream}
          activeCall={activeCall}
          currentUserId={user?.id}
          allUsers={users}
          onEndCall={endCall}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
        />
      )}
    </div>
  )
}

export default App