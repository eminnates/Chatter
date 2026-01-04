import { useState, useEffect, useRef, useCallback, memo } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'
import logoImage from './assets/logo.png'
import { useWebRTC } from './hooks/useWebRTC'
import IncomingCallModal from './components/IncomingCallModal'
import ActiveCallScreen from './components/ActiveCallScreen'
import ProfilePage from './components/ProfilePage'
import { 
  CheckCircle2, XCircle, Info, Phone, Video, 
  Check, CheckCheck, Paperclip, X, File, LogOut, User, Menu, Sun, Moon, Volume2, VolumeX,
  Maximize2, Loader
} from 'lucide-react'
import { App as CapacitorApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar'
import { SplashScreen } from '@capacitor/splash-screen';


// === HARDCODED BACKEND CONFIG ===
const BACKEND_URL = 'https://aretha-intercompany-corinna.ngrok-free.dev'
const API_URL = BACKEND_URL + '/api'
const HUB_URL = BACKEND_URL + '/hubs/chat'

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// === HAPTIC FEEDBACK HELPER ===
const triggerHaptic = async (style = ImpactStyle.Light) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style })
    } catch (e) {
      console.log('Haptics not available')
    }
  }
}

// SecureImage component
const SecureImage = memo(({ src, alt, className, onClick }) => {
  const [imageSrc, setImageSrc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!src) return
    
    let isMounted = true
    setLoading(true)
    setError(false)

    fetch(src, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to load image')
        return response.blob()
      })
      .then(blob => {
        if (isMounted) {
          const objectUrl = URL.createObjectURL(blob)
          setImageSrc(objectUrl)
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('SecureImage load error:', err)
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
      if (imageSrc) URL.revokeObjectURL(imageSrc)
    }
  }, [src])

  if (loading) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(184, 212, 168, 0.1)', minHeight: '100px' }}>
        <Loader size={24} className="spinning" style={{ color: '#B8D4A8' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245, 140, 140, 0.1)', minHeight: '100px', color: '#f58c8c' }}>
        <span>Resim yüklenemedi</span>
      </div>
    )
  }

  return <img src={imageSrc} alt={alt} className={className} onClick={onClick} />
})

// === OPTIMIZED USER LIST ITEM ===
const UserListItem = memo(({ user, isSelected, onClick, onContextMenu, unreadCount, isOnline }) => {
  return (
    <div 
      className={`user-item ${isSelected ? 'active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="user-avatar">
        {(user.fullName?.[0] || user.userName?.[0] || '?').toUpperCase()}
      </div>
      <div className="user-row">
        <div className="user-info">
          <span className="user-name">{user.fullName || user.userName}</span>
          {isOnline && <span className="online-dot" title="Online" />}
        </div>
        {unreadCount > 0 && (
          <div className="notification-badge">{unreadCount}</div>
        )}
      </div>
    </div>
  )
})

// === OPTIMIZED MESSAGE ITEM ===
const MessageItem = memo(({ msg, currentUserId, onImageClick }) => {
  if (msg.type === 'System') {
    const isDeclined = msg.content.includes('declined');
    const isMissed = msg.content.includes('Missed');
    const isNegative = isDeclined || isMissed;
    
    return (
      <div className="system-message">
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
  
  return (
    <div className={`message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}>
      <div className="msg-bubble">
        {msg.attachments?.map(att => (
          <div key={att.id} style={{ marginBottom: 10 }}>
            {att.type === 'Image' || att.type === '1' || att.type === 1 ? (
              <div 
                className="msg-image-container"
                onClick={() => onImageClick(`${BACKEND_URL}${att.fileUrl}`)}
              >
                <SecureImage 
                  src={`${BACKEND_URL}${att.fileUrl}`} 
                  alt={att.fileName}
                  className="msg-image"
                />
                <div className="msg-image-overlay">
                  <Maximize2 size={24} />
                </div>
              </div>
            ) : (
              <a 
                href={`${BACKEND_URL}${att.fileUrl}`} 
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
        {msg.senderId === currentUserId && (
          <span className={`read-status ${msg.isRead ? 'read' : 'sent'}`}>
            {msg.isRead ? <CheckCheck size={16} /> : <Check size={16} />}
          </span>
        )}
      </div>
    </div>
  );
})

// === SOUND EFFECTS ===
const createSoundEffect = (frequency, duration, type = 'sine', volume = 0.3) => {
  return () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = type
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration)
    } catch (err) {
      console.log('Sound not supported:', err)
    }
  }
}

const sounds = {
  messageSent: () => {
    const play = createSoundEffect(440, 0.15, 'sine', 0.2)
    play()
    setTimeout(() => createSoundEffect(587, 0.1, 'sine', 0.15)(), 50)
  },
  messageReceived: () => {
    const play = createSoundEffect(587, 0.12, 'sine', 0.25)
    play()
    setTimeout(() => createSoundEffect(440, 0.15, 'sine', 0.2)(), 60)
  },
  notification: () => {
    createSoundEffect(523, 0.2, 'sine', 0.2)()
    setTimeout(() => createSoundEffect(659, 0.25, 'sine', 0.15)(), 100)
  },
  connect: () => {
    createSoundEffect(392, 0.1, 'sine', 0.15)()
    setTimeout(() => createSoundEffect(523, 0.1, 'sine', 0.15)(), 80)
    setTimeout(() => createSoundEffect(659, 0.15, 'sine', 0.2)(), 160)
  }
}

function App() {
  // === STATES ===
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user'))
    } catch {
      return null
    }
  })
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('soundEnabled') !== 'false')
  
  const [users, setUsers] = useState([]) 
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [connection, setConnection] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [selectedFile, setSelectedFile] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [toast, setToast] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [typingTimeout, setTypingTimeout] = useState(null)
  const [showProfilePage, setShowProfilePage] = useState(false)
  const [viewProfileUserId, setViewProfileUserId] = useState(null)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isAppActive, setIsAppActive] = useState(true)
  
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
  const isAppActiveRef = useRef(true)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageInputRef = useRef(null)
  const loginEmailRef = useRef(null)
  const registerUsernameRef = useRef(null)
  const pendingNotificationsRef = useRef({})
  const sidebarRef = useRef(null)
  const touchStartXRef = useRef(0)
  const touchStartYRef = useRef(0)
  // 🔄 1. STATE REFS (Kritik: Listener'ların güncel veriyi görmesi için)
  // Bu ref'ler sayesinde useEffect'leri tekrar tekrar çalıştırmak zorunda kalmayız.
  const connectionRef = useRef(connection);
  const tokenRef = useRef(token);
  
  // UI State Ref'leri (Back Button için gerekli)
  const lightboxImageRef = useRef(lightboxImage);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  const showProfilePageRef = useRef(showProfilePage);

  // === TOAST ===
  const showToast = useCallback((message, type = 'info') => {
    let displayMessage = message
    if (message.length > 150) {
      displayMessage = message.substring(0, 150) + '...'
    }
    setToast({ message: displayMessage, type })
    
    if (type === 'error') {
      triggerHaptic(ImpactStyle.Medium)
    }
  }, [])

  // === NOTIFICATIONS ===
  const requestNotificationPermission = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalNotifications.requestPermissions()
        console.log('📱 Mobile notification permission:', result.display)
      } catch (err) {
        console.error('Mobile notification permission error:', err)
      }
    } else {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [])

  const showNotification = useCallback(async (senderId, senderName, messageContent) => {
    await triggerHaptic(ImpactStyle.Light)
    
    if (Capacitor.isNativePlatform()) {
      try {
        const permResult = await LocalNotifications.checkPermissions()
        if (permResult.display !== 'granted') {
          const requestResult = await LocalNotifications.requestPermissions()
          if (requestResult.display !== 'granted') return
        }
        
        if (!pendingNotificationsRef.current[senderId]) {
          pendingNotificationsRef.current[senderId] = {
            senderName: senderName,
            messages: []
          }
        }
        pendingNotificationsRef.current[senderId].messages.push(messageContent)
        
        const userNotifications = pendingNotificationsRef.current[senderId]
        const messageCount = userNotifications.messages.length
        const allMessages = userNotifications.messages.slice(-10)
        
        const notificationId = Math.abs(senderId.split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0)
          return a & a
        }, 0)) % 2147483647
        
        const title = senderName
        const body = messageCount === 1 ? messageContent : `${messageCount} yeni mesaj`
        const largeBody = allMessages.join('\n')
        
        try {
          await LocalNotifications.cancel({ notifications: [{ id: notificationId }] })
        } catch (e) {}
        
        await LocalNotifications.schedule({
          notifications: [{
            id: notificationId,
            title: title,
            body: body,
            largeBody: largeBody,
            summaryText: messageCount > 1 ? `${messageCount} mesaj` : undefined,
            inboxList: messageCount > 1 ? allMessages : undefined,
            sound: 'default',
            channelId: 'chatter-messages',
            autoCancel: true,
            group: 'chatter-messages',
            groupSummary: false
          }]
        })
        console.log('📱 Notification:', title, '-', body)
      } catch (err) {
        console.error('📱 Notification error:', err)
      }
    } else {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        if (Notification.permission === 'default') Notification.requestPermission()
        return
      }
      
      if (!pendingNotificationsRef.current[senderId]) {
        pendingNotificationsRef.current[senderId] = { senderName, messages: [] }
      }
      pendingNotificationsRef.current[senderId].messages.push(messageContent)
      
      const userNotifications = pendingNotificationsRef.current[senderId]
      const messageCount = userNotifications.messages.length
      
      const notification = new Notification(senderName, {
        body: messageCount === 1 ? messageContent : `${messageCount} yeni mesaj`,
        icon: '/icon.png',
        tag: `chatter-${senderId}`,
        renotify: true
      })
      
      notification.onclick = () => {
        window.focus()
        notification.close()
        delete pendingNotificationsRef.current[senderId]
      }
      setTimeout(() => notification.close(), 5000)
    }
  }, [])
  useEffect(() => {
    connectionRef.current = connection;
    tokenRef.current = token;
    lightboxImageRef.current = lightboxImage;
    isMobileSidebarOpenRef.current = isMobileSidebarOpen;
    showProfilePageRef.current = showProfilePage;
  }, [connection, token, lightboxImage, isMobileSidebarOpen, showProfilePage]);

  useEffect(() => {
    const initNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await LocalNotifications.createChannel({
            id: 'chatter-messages',
            name: 'Chatter Messages',
            description: 'Notifications for new messages',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true
          })
          console.log('📱 Notification channel created')
        } catch (err) {
          console.error('Channel creation error:', err)
        }
        
        try {
          const permStatus = await PushNotifications.checkPermissions()
          console.log('📱 Push permission status:', permStatus.receive)
          
          if (permStatus.receive !== 'granted') {
            const newStatus = await PushNotifications.requestPermissions()
            if (newStatus.receive !== 'granted') {
              console.log('📱 Push notification permission denied')
            }
          }
          
          await PushNotifications.register()
          
          PushNotifications.addListener('registration', async (token) => {
            console.log('📱 FCM Token:', token.value)
            const storedToken = localStorage.getItem('token')
            if (storedToken) {
              try {
                await axios.post(`${API_URL}/user/fcm-token`, 
                  { token: token.value },
                  { headers: { Authorization: `Bearer ${storedToken}` } }
                )
                console.log('📱 FCM token sent to server')
              } catch (err) {
                console.error('Error sending FCM token:', err)
              }
            }
          })
          
          PushNotifications.addListener('registrationError', (error) => {
            console.error('📱 Push registration error:', error)
          })
          
          PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('📱 Push notification received:', notification)
          })
          
          PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('📱 Push notification tapped:', notification)
          })
          
        } catch (err) {
          console.error('📱 Push notification setup error:', err)
        }
      }
      requestNotificationPermission()
    }
    initNotifications()
  }, [requestNotificationPermission])

// 📱 NATIVE LIFECYCLE & HARDWARE BACK BUTTON & KEYBOARD
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appStateListener = null;
    let backButtonListener = null;

    const setupNativeListeners = async () => {
      
      // 1. KLAVYE AYARI (Senin kodundaki Native optimizations kısmı)
      try {
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
      } catch (e) { 
        console.warn('Keyboard resize mode error', e); 
      }

      // 2. APP STATE (SignalR - Offline/Online Yönetimi)
      appStateListener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        console.log(`📱 App state: ${isActive ? 'foreground' : 'background'}`);
        setIsAppActive(isActive);
        
        const currentConn = connectionRef.current;
        const currentToken = tokenRef.current;

        if (!currentConn) return;

        if (!isActive) {
          // BACKGROUND: Fire and Forget
          if (currentConn.state === signalR.HubConnectionState.Connected) {
            currentConn.invoke('SetUserOffline')
              .catch(err => console.warn('Offline status skipped:', err));
          }
        } else {
          // FOREGROUND: Reconnect
          if (currentConn.state === signalR.HubConnectionState.Disconnected) {
            try {
              await currentConn.start();
              setConnectionStatus('connected');
              await currentConn.invoke('SetUserOnline');
              console.log('✅ Reconnected');
            } catch (err) {
              console.error('Reconnect failed:', err);
              setConnectionStatus('failed');
            }
          } else if (currentConn.state === signalR.HubConnectionState.Connected) {
            currentConn.invoke('SetUserOnline').catch(console.error);
          }
          
          if (currentToken) loadUsers(currentToken);
        }
      });

      // 3. HARDWARE BACK BUTTON (Geri Tuşu Yönetimi)
      backButtonListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // State yerine REF kullanıyoruz (En güncel değeri okumak için)
        if (lightboxImageRef.current) {
          setLightboxImage(null);
          return;
        }
        if (isMobileSidebarOpenRef.current) {
          setIsMobileSidebarOpen(false);
          return;
        }
        if (showProfilePageRef.current) {
          setShowProfilePage(false);
          return;
        }
        
        // Modal yoksa ve geçmiş bittiyse uygulamadan çık
        if (!canGoBack) {
          CapacitorApp.exitApp();
        } else {
          window.history.back();
        }
      });
    };

    setupNativeListeners();

    // CLEANUP: Sadece bu effect'in oluşturduğu listener'ları siliyoruz.
    // 'removeAllListeners' KULLANMIYORUZ, çünkü o global temizlik yapar ve sistemi bozar.
    return () => {
      if (appStateListener) appStateListener.remove();
      if (backButtonListener) backButtonListener.remove();
    };
  }, []); // <--- BOŞ ARRAY: Sadece 1 kez çalışır, Ref'ler sayesinde hep güncel kalır.

// 🚀 5. SPLASH SCREEN & MOBILE DETECT
  useEffect(() => {
    // Splash
    const hideSplash = async () => {
      await SplashScreen.hide();
    };
    hideSplash();

    // Mobile Check
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Swipe gesture
  useEffect(() => {
    if (!isMobile) return

    const handleTouchStart = (e) => {
      touchStartXRef.current = e.touches[0].clientX
      touchStartYRef.current = e.touches[0].clientY
    }

    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const diffX = touchEndX - touchStartXRef.current
      const diffY = touchEndY - touchStartYRef.current
      
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 80) {
        if (diffX > 0 && touchStartXRef.current < 50) {
          setIsMobileSidebarOpen(true)
        } else if (diffX < 0 && isMobileSidebarOpen) {
          setIsMobileSidebarOpen(false)
        }
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, isMobileSidebarOpen])

  // ⌨️ 4. KEYBOARD AUTO-SCROLL
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let keyboardShowListener = null;
    let keyboardHideListener = null;

    const setupKeyboard = async () => {
      keyboardShowListener = await Keyboard.addListener('keyboardWillShow', () => {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 150); // Klavye animasyonu bitmesi için biraz süre ver
      });
    };

    setupKeyboard();

    return () => {
      if (keyboardShowListener) keyboardShowListener.remove();
      if (keyboardHideListener) keyboardHideListener.remove();
    };
  }, []);


  // WebRTC
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

  const handleInitiateCall = useCallback((receiverId, callType) => {
    if (receiverId === user?.id) {
      showToast('You cannot call yourself.', 'error')
      return
    }
    
    if (activeCall && (callStatus === 'active' || callStatus === 'ringing')) {
      showToast('You are already in an active call.', 'error')
      return
    }
    
    triggerHaptic(ImpactStyle.Medium)
    initiateCall(receiverId, callType)
  }, [activeCall, callStatus, initiateCall, showToast, user?.id])

  // Sync refs
  useEffect(() => { selectedUserRef.current = selectedUser }, [selectedUser])
  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { usersRef.current = users }, [users])

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const playSound = useCallback((soundName) => {
    if (soundEnabled && sounds[soundName]) {
      sounds[soundName]()
    }
  }, [soundEnabled])

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark'
      return newTheme
    })
    triggerHaptic(ImpactStyle.Light)
  }, [])

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev
      localStorage.setItem('soundEnabled', newValue.toString())
      if (newValue) sounds.connect()
      return newValue
    })
    triggerHaptic(ImpactStyle.Light)
  }, [])

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Auto-focus
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

  useEffect(() => {
    if (selectedUser && messageInputRef.current) {
      setTimeout(() => {
        messageInputRef.current?.focus()
      }, 100)
    }
  }, [selectedUser])

  // Mark as read
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

  // Load users
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
        setTimeout(() => loadUsers(activeToken, retryCount + 1), delay)
      } else {
        showToast('Failed to load users.', 'error')
      }
    }
  }, [showToast])

  // Load messages
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

  // SignalR connection
  useEffect(() => {
    if (!token) {
      if (connection) {
        connection.stop()
        setConnection(null)
        setConnectionStatus('disconnected')
      }
      return
    }

    let isMounted = true
    let newConnection = null

    const setupSignalR = async () => {
      setConnectionStatus('connecting')
      loadUsers(token)

      newConnection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { 
          accessTokenFactory: () => token,
          transport: signalR.HttpTransportType.WebSockets,
          headers: { "ngrok-skip-browser-warning": "true" },
          skipNegotiation: true
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Information)
        .build()

      newConnection.keepAliveIntervalInMilliseconds = 15000
      newConnection.serverTimeoutInMilliseconds = 30000

      try {
        await newConnection.start()
        console.log("✅ SignalR Connected")
        if (isMounted) {
          setConnection(newConnection)
          setConnectionStatus('connected')
        }

        newConnection.on('ReceiveMessage', (message) => {
          const senderId = message.senderId || message.SenderId;
          const receiverId = message.receiverId || message.ReceiverId;
          const content = message.content || message.Content;

          const incomingSenderId = senderId?.toLowerCase();
          const currentUserId = userRef.current?.id?.toLowerCase();
          const selectedUserId = selectedUserRef.current?.id?.toLowerCase();

          const isMyMessage = incomingSenderId === currentUserId;
          const isFromSelectedUser = incomingSenderId === selectedUserId;

          if (isMyMessage || isFromSelectedUser) {
            setMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;

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

            if (!isMyMessage && isFromSelectedUser) {
              playSound('messageReceived')
            }

            if (isFromSelectedUser && !isMyMessage && isAppActiveRef.current) {
              markAsRead(senderId);
              setIsTyping(false);
            }
          }
          
          if (!isMyMessage && (!isFromSelectedUser || !isAppActiveRef.current)) {
            playSound('notification')
            
            if (!Capacitor.isNativePlatform()) {
              const sender = usersRef.current.find(u => u.id?.toLowerCase() === incomingSenderId);
              const senderName = sender?.fullName || sender?.userName || message.senderName || 'Someone';
              const messageContent = message.content?.substring(0, 100) || 'New message';
              showNotification(senderId, senderName, messageContent);
            }
          }

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

        newConnection.on('MessagesRead', () => {
          setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })))
        })
        
        newConnection.on('UserOnline', (userId) => {
          setUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, isOnline: true } : u
          ))
          setSelectedUser(prev => 
            prev?.id === userId ? { ...prev, isOnline: true } : prev
          )
        })

        newConnection.on('UserOffline', (userId) => {
          setUsers(prev => prev.map(u => 
            u.id === userId ? { ...u, isOnline: false } : u
          ))
          setSelectedUser(prev => 
            prev?.id === userId ? { ...prev, isOnline: false } : prev
          )
        })

        newConnection.on('UserTyping', (userId) => {
          if (selectedUserRef.current?.id === userId) {
            setIsTyping(true)
            if (typingTimeout) clearTimeout(typingTimeout)
            const timeout = setTimeout(() => setIsTyping(false), 3000)
            setTypingTimeout(timeout)
          }
        })

        newConnection.on('UserStoppedTyping', (userId) => {
          if (selectedUserRef.current?.id === userId) {
            setIsTyping(false)
            if (typingTimeout) clearTimeout(typingTimeout)
          }
        })
        
        newConnection.on('ErrorMessage', (errorMsg) => {
          console.error("Backend Error:", errorMsg)
          showToast(errorMsg, 'error')
        })

      } catch (err) {
        console.error('❌ SignalR Error:', err)
        if (isMounted) {
          setConnectionStatus('failed')
          showToast('Connection failed.', 'error')
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
  }, [token, loadUsers, markAsRead, showToast, playSound, showNotification])

  // Select user
  const handleSelectUser = useCallback(async (u) => {
    setSelectedUser(u)
    setIsTyping(false)
    markAsRead(u.id)
    
    await triggerHaptic(ImpactStyle.Light)
    
    if (pendingNotificationsRef.current[u.id]) {
      delete pendingNotificationsRef.current[u.id]
      
      if (Capacitor.isNativePlatform()) {
        try {
          const notificationId = Math.abs(u.id.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0)
            return a & a
          }, 0)) % 2147483647
          await LocalNotifications.cancel({ notifications: [{ id: notificationId }] })
        } catch (e) {}
      }
    }
    
    if (isMobile) {
      setIsMobileSidebarOpen(false)
    }
  }, [markAsRead, isMobile])

  // Load messages when user selected
  useEffect(() => {
    if (selectedUser?.id && token) {
      loadMessages(selectedUser.id)
    }
  }, [selectedUser?.id, token, loadMessages])

  // Typing notification
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

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault()
    
    if ((!messageInput.trim() && !selectedFile) || !selectedUser || !connection || connectionStatus !== 'connected') {
      if (connectionStatus !== 'connected') {
        showToast('Connection lost.', 'error')
      }
      return
    }

    let currentUser = user
    if (!currentUser) {
      try {
        const storedUser = localStorage.getItem('user')
        currentUser = storedUser ? JSON.parse(storedUser) : null
      } catch (err) {
        console.error('Failed to parse user:', err)
      }
    }

    if (!currentUser?.id) {
      showToast('Session expired.', 'error')
      logout()
      return
    }

    const content = messageInput.trim()
    let attachmentData = null

    try {
      if (selectedFile) {
        setIsUploading(true)
        setUploadProgress(0)
        
        const formData = new FormData()
        formData.append('file', selectedFile)

        const { data } = await axios.post(`${API_URL}/files/upload`, formData, {
          headers: { Authorization: `Bearer ${token}` },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setUploadProgress(percentCompleted)
          }
        })
        
        setIsUploading(false)
        setUploadProgress(0)

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
      
      await triggerHaptic(ImpactStyle.Light)
      playSound('messageSent')

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
      console.error("Send message error:", err)
      setIsUploading(false)
      setUploadProgress(0)
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.title ||
                          err.message ||
                          'Failed to send message'
      showToast(errorMessage, 'error')
      setMessages(prev => prev.filter(m => !m.id.toString().startsWith('temp-')))
    }
  }

  // Auth handlers
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

  const login = async (e) => {
    e.preventDefault()
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, loginForm)
      handleAuthSuccess(data)
      showToast('Welcome back!', 'success')
    } catch (error) {
      const errorData = error.response?.data
      let errorMessage = 'Invalid email or password.'
      
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
          errorMessage = allErrors.length === 1 ? allErrors[0] : `${allErrors[0]} and ${allErrors.length - 1} more`
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message
      } else if (errorData?.title && errorData.title !== 'One or more validation errors occurred.') {
        errorMessage = errorData.title
      }
      
      showToast(errorMessage, 'error')
    }
  }

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
          showToast('Welcome! 🎉', 'success')
        } catch (loginError) {
          showToast('Account created! Please login.', 'success')
          setIsRegistering(false)
        }
      } else {
        handleAuthSuccess(data)
        showToast('Welcome! 👋', 'success')
      }
    } catch (error) {
      const errorData = error.response?.data
      let errorMessage = 'Registration failed.'
      
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
          errorMessage = allErrors.length === 1 ? allErrors[0] : `${allErrors[0]} and ${allErrors.length - 1} more`
        }
      } else if (errorData?.message) {
        errorMessage = errorData.message
      } else if (errorData?.title) {
        errorMessage = errorData.title
      }
      
      showToast(errorMessage, 'error')
    }
  }

  const logout = async () => {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
      try {
        await connection.invoke('SetUserOffline')
      } catch (err) {
        console.error('SetUserOffline error:', err)
      }
      
      try {
        await connection.stop()
      } catch (err) {
        console.error('Logout connection stop error:', err)
      }
    }
    
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    
    setToken(null)
    setUser(null)
    setMessages([])
    setSelectedUser(null)
    setUsers([])
    setConnectionStatus('disconnected')
    setConnection(null)
  }

  // Login/Register Screen
  if (!token) {
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
            <img src={logoImage} alt="Chatter Logo" />
          </div>
          <h2>{isRegistering ? 'Join the conversation 🎉' : 'Hey there! 👋'}</h2>
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
            <button type="submit">{isRegistering ? 'Get Started ✨' : 'Let\'s Go!'}</button>
            <p onClick={() => setIsRegistering(!isRegistering)}>
              {isRegistering ? 'Already have an account? Sign in here' : "New here? Create an account"}
            </p>
          </form>
        </div>
      </div>
    )
  }

  // Main Chat Interface
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

      {isMobile && (
        <div 
          className={`sidebar-backdrop ${isMobileSidebarOpen ? 'visible' : ''}`}
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className={`sidebar ${isMobile && !isMobileSidebarOpen ? 'mobile-hidden' : ''}`}>
        <div className="sidebar-header">
          <h3>Chatter</h3>
          <div className="user-profile-summary">
            <small>{user?.fullName || user?.userName}</small>
            {connectionStatus === 'connecting' && (
              <span className="connection-status connecting">
                <span className="status-dot"></span>
                Getting ready...
              </span>
            )}
            {connectionStatus === 'failed' && (
              <span className="connection-status disconnected">
                <span className="status-dot"></span>
                Reconnecting...
              </span>
            )}
          </div>
          <div className="sidebar-header-actions">
            <button onClick={toggleTheme} className="theme-btn" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={toggleSound} className="sound-btn" title={soundEnabled ? 'Mute' : 'Unmute'}>
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button onClick={() => {
              setViewProfileUserId(null)
              setShowProfilePage(true)
            }} className="profile-btn">
              <User size={18} />
              <span>Profile</span>
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
              {connectionStatus === 'connecting' ? 'Finding your friends...' : 'Your friends will appear here ✨'}
            </p>
          ) : (
            users.filter(u => u.id !== user?.id).map(u => (
              <UserListItem
                key={u.id}
                user={u}
                isSelected={selectedUser?.id === u.id}
                onClick={() => handleSelectUser(u)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setViewProfileUserId(u.id)
                  setShowProfilePage(true)
                }}
                unreadCount={u.unreadCount}
                isOnline={u.isOnline}
              />
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
            API_URL={API_URL}
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
              {messages.map((msg, i) => (
                <MessageItem
                  key={msg.id || i}
                  msg={msg}
                  currentUserId={user?.id}
                  onImageClick={setLightboxImage}
                />
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
                  {selectedFile.type?.startsWith('image/') ? (
                    <>
                      <img 
                        src={URL.createObjectURL(selectedFile)} 
                        alt="Preview" 
                        className="file-preview-image"
                      />
                      <div className="file-preview-info">
                        <span className="file-preview-name">{selectedFile.name}</span>
                        <span className="file-preview-size">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <File size={20} />
                      <div className="file-preview-info">
                        <span className="file-preview-name">{selectedFile.name}</span>
                        <span className="file-preview-size">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </>
                  )}
                  {isCompressing && (
                    <div className="compression-status">
                      <Loader size={14} className="spinning" />
                      <span>Compressing...</span>
                    </div>
                  )}
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
              
              {isUploading && (
                <div className="upload-progress-container">
                  <div 
                    className="upload-progress-bar" 
                    style={{ width: `${uploadProgress}%` }}
                  />
                  <span className="upload-progress-text">{uploadProgress}%</span>
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
                placeholder="Say something nice..."
                disabled={connectionStatus !== 'connected'}
              />
              <button type="submit" disabled={connectionStatus !== 'connected'}>
                {connectionStatus === 'connecting' ? '...' : '✨ Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat">
            <div className="no-chat-content">
              <h2>Ready to chat? 💬</h2>
              <p>Pick a friend from the sidebar and say hello!</p>
            </div>
          </div>
        )}
      </div>

      {callStatus === 'ringing' && activeCall && activeCall.initiatorId !== user?.id && (
        <IncomingCallModal 
          call={activeCall}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

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

      {/* Lightbox Image Viewer */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>
            <X size={32} />
          </button>
          <SecureImage 
            src={lightboxImage} 
            alt="Full size" 
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

export default App