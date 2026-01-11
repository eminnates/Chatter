import { useState, useEffect, useRef, useCallback } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'

// --- CONFIG & UTILS ---
import { API_URL, HUB_URL } from './config/constants'
import { sounds } from './utils/soundManager'
import { checkAndroidUpdate } from './utils/androidUpdater';

// --- COMPONENTS ---
import AuthScreen from './components/Auth/AuthScreen'
import Sidebar from './components/Chat/Sidebar'
import ChatWindow from './components/Chat/ChatWindow'
import IncomingCallModal from './components/Call/IncomingCallModal'
import ActiveCallScreen from './components/Call/ActiveCallScreen'
import OutgoingCallScreen from './components/Call/OutgoingCallScreen'
import ProfilePage from './components/Profile/ProfilePage'
import Lightbox from './components/Common/Lightbox'
import Toast from './components/Common/Toast'
import TitleBar from './components/Common/TitleBar' // TitleBar path'ini kontrol et

// --- HOOKS ---
import { useWebRTC } from './hooks/useWebRTC'

// --- NATIVE & ICONS ---
import { App as CapacitorApp } from '@capacitor/app'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'

// Axios Config
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// --- HAPTIC HELPER ---
const triggerHaptic = async (style = ImpactStyle.Light) => {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.impact({ style }) } catch (e) { console.log('Haptics unavailable') }
  }
}

function App() {
  // === STATES ===
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
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
  const [replyingTo, setReplyingTo] = useState(null)
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
  const [isFirstConnection, setIsFirstConnection] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // === REFS ===
  const selectedUserRef = useRef(null) 
  const userRef = useRef(user)
  const usersRef = useRef(users)
  
  const connectionRef = useRef(connection);
  const tokenRef = useRef(token);
  const lightboxImageRef = useRef(lightboxImage);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  const showProfilePageRef = useRef(showProfilePage);

  // === HELPER: GET SAFE USER ID ===
  const getSafeUserId = (u) => {
    if (!u) return null;
    return u.id || u.userId || u.user?.id || u.data?.id || u.data?.userId;
  }

  // === TOAST ===
  const showToast = useCallback((message, type = 'info') => {
    let displayMessage = message
    if (message.length > 150) displayMessage = message.substring(0, 150) + '...'
    setToast({ message: displayMessage, type })
    if (type === 'error') triggerHaptic(ImpactStyle.Medium)
    const duration = Math.min(Math.max(message.length * 50, 3000), 7000)
    setTimeout(() => setToast(null), duration)
  }, [])

  // === SOUND ===
  const playSound = useCallback((soundName) => {
    if (soundEnabled && sounds[soundName]) sounds[soundName]()
  }, [soundEnabled])

  // === DATA LOADERS ===
  const loadUsers = useCallback(async (activeToken) => {
    try {
      const { data } = await axios.get(`${API_URL}/user`, { headers: { Authorization: `Bearer ${activeToken}` } })
      setUsers(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
       if (error.response?.status === 401) logout();
    }
  }, [])

  const loadMessages = useCallback(async (userId) => {
    if (!token) return;
    try {
      const convRes = await axios.post(`${API_URL}/chat/conversation/${userId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
      const convId = convRes.data.value || convRes.data.id || convRes.data;
      if (!convId) throw new Error("No Conv ID");
      const msgRes = await axios.get(`${API_URL}/chat/messages/${convId}`, { headers: { Authorization: `Bearer ${token}` } })
      
      const allMessages = (Array.isArray(msgRes.data) ? msgRes.data : msgRes.data.data || [])
        .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
      
      setMessages(allMessages);
      
      // Son mesajı user listesine işle
      if (allMessages.length > 0) {
        const lastMsg = allMessages[allMessages.length - 1];
        setUsers(prev => prev.map(u => 
          u.id === userId 
            ? { ...u, lastMessage: lastMsg.content || (lastMsg.attachments?.length > 0 ? '📎 Attachment' : ''), lastMessageTime: lastMsg.sentAt }
            : u
        ));
      }
    } catch (error) { setMessages([]); }
  }, [token])

  const markAsRead = useCallback(async (targetUserId) => {
    if (!token) return
    try {
      await axios.post(`${API_URL}/chat/mark-read/${targetUserId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, unreadCount: 0 } : u))
    } catch (e) {}
  }, [token])

  // === ACTIONS ===
  const handleSelectUser = useCallback((u) => {
    setSelectedUser(u); 
    setIsTyping(false);
    setReplyingTo(null);
    markAsRead(u.id);
    if(isMobile) setIsMobileSidebarOpen(false);
  }, [markAsRead, isMobile]);

  // === NOTIFICATIONS (DÜZELTİLEN KISIM) ===
  const requestNotificationPermission = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try { await LocalNotifications.requestPermissions() } catch (err) {}
    } else {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    }
  }, [])

  const showNotification = useCallback(async (senderId, senderName, messageContent) => {
    await triggerHaptic(ImpactStyle.Light)
    
    // DESKTOP & WEB
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'granted') {
       const notif = new Notification(senderName, { 
         body: messageContent, 
         icon: '/icon.png',
         silent: true 
       });
       
       // TIKLAMA OLAYI
       notif.onclick = () => {
         window.focus();
         // usersRef.current içinden kullanıcıyı bul
         const targetUser = usersRef.current.find(u => u.id === senderId);
         if (targetUser) {
           handleSelectUser(targetUser);
         }
         notif.close();
       };
    }
    
    // MOBILE
    if (Capacitor.isNativePlatform()) {
       // Mobil bildirim mantığı buraya...
    }
  }, [handleSelectUser]) // handleSelectUser eklendi

  // === ACTIONS: Refresh & Swipe ===
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadUsers(token)
    if (selectedUser) await loadMessages(selectedUser.id)
    setRefreshing(false)
    triggerHaptic(ImpactStyle.Light)
  }

  const handleSwipeRight = () => {
    if (isMobile && !isMobileSidebarOpen) {
      setIsMobileSidebarOpen(true)
    }
  }

  // === SYNC REFS ===
  useEffect(() => {
    connectionRef.current = connection;
    tokenRef.current = token;
    lightboxImageRef.current = lightboxImage;
    isMobileSidebarOpenRef.current = isMobileSidebarOpen;
    showProfilePageRef.current = showProfilePage;
    selectedUserRef.current = selectedUser;
    userRef.current = user;
    usersRef.current = users;
  }, [connection, token, lightboxImage, isMobileSidebarOpen, showProfilePage, selectedUser, user, users]);

  // === NATIVE LISTENERS ===
  useEffect(() => {
    const init = async () => {
        // 1. Mobil Platform Kontrolü
        if(Capacitor.isNativePlatform()) {
            document.body.classList.add('is-mobile');
            await SplashScreen.hide();
            await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
            
            // App State (Arka plan / Ön plan) Dinleyicisi
            CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
                setIsAppActive(isActive);
                const conn = connectionRef.current;
                if(!conn) return;
                if(!isActive && conn.state === signalR.HubConnectionState.Connected) {
                     conn.invoke('SetUserOffline').catch(console.error);
                } else if(isActive && conn.state === signalR.HubConnectionState.Disconnected) {
                     await conn.start();
                     conn.invoke('SetUserOnline');
                     if(tokenRef.current) loadUsers(tokenRef.current);
                }
            });

            // Geri Tuşu Dinleyicisi
            CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                if(lightboxImageRef.current) { setLightboxImage(null); return; }
                if(isMobileSidebarOpenRef.current) { setIsMobileSidebarOpen(false); return; }
                if(showProfilePageRef.current) { setShowProfilePage(false); return; }
                if(!canGoBack) CapacitorApp.exitApp(); else window.history.back();
            });

            // --- YENİ EKLENEN KISIM: ANDROID GÜNCELLEME KONTROLÜ ---
            if (Capacitor.getPlatform() === 'android') {
                // Uygulama açıldıktan 3 saniye sonra kontrol etsin (Hemen ekrana fırlamasın)
                setTimeout(() => {
                    checkAndroidUpdate(showToast);
                }, 3000);
            }
            // -------------------------------------------------------
        }
        
        // 2. Electron Kontrolü
        if (window.electronAPI?.isElectron) {
            document.body.classList.add('is-electron');
        }
    }
    init();
  }, [loadUsers, showToast]); // showToast'u dependency'e ekledik

  // Connection Toast Logic
  useEffect(() => {
    if (connectionStatus === 'connected') {
      if (isFirstConnection) {
        setIsFirstConnection(false)
      } else {
        showToast('Reconnected', 'success')
        playSound('connect')
      }
    } else if (connectionStatus === 'failed') {
      showToast('Connection lost. Retrying...', 'error')
    }
  }, [connectionStatus, isFirstConnection, showToast, playSound])

  // Theme Transition
  useEffect(() => {
    document.documentElement.classList.add('theme-transitioning')
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning')
    }, 300)
  }, [theme])

  // Mobile Check
  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth <= 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Notification Request
  useEffect(() => {
    if (token && !localStorage.getItem('notificationAsked')) {
      setTimeout(() => {
        requestNotificationPermission()
        localStorage.setItem('notificationAsked', 'true')
      }, 3000)
    }
  }, [token, requestNotificationPermission])

  // === WEBRTC ===
  const { localStream, remoteStream, callStatus, activeCall, initiateCall, acceptCall, declineCall, endCall, toggleAudio, toggleVideo } = useWebRTC(connection, getSafeUserId(user), showToast, showNotification)

  const handleInitiateCall = useCallback((receiverId, callType) => {
    const myId = getSafeUserId(user);
    if (receiverId === myId) { showToast('Cannot call yourself', 'error'); return }
    if (activeCall && callStatus !== 'idle') { showToast('Already in call', 'error'); return }
    triggerHaptic(ImpactStyle.Medium)
    initiateCall(receiverId, callType)
  }, [activeCall, callStatus, initiateCall, showToast, user])

  // === SIGNALR ===
  useEffect(() => {
      if (!token) return;
      setConnectionStatus('connecting');
      loadUsers(token);

      const newConnection = new signalR.HubConnectionBuilder()
          .withUrl(HUB_URL, { 
              accessTokenFactory: () => token, 
              skipNegotiation: true, 
              transport: signalR.HttpTransportType.WebSockets 
          })
          .withAutomaticReconnect({
              nextRetryDelayInMilliseconds: retryContext => {
                  if (retryContext.elapsedMilliseconds < 60000) {
                      return Math.random() * 2000;
                  } else {
                      return 5000;
                  }
              }
          })
          .configureLogging(signalR.LogLevel.Information)
          .build();

      // ⬇️ BAĞLANTI KURULUNCA
      newConnection.start()
          .then(() => {
              setConnection(newConnection);
              setConnectionStatus('connected');
              console.log("✅ SignalR Connected");
              
              // ⬇️ Bağlanınca online ol
              newConnection.invoke('SetUserOnline')
                  .then(() => {
                      console.log("✅ User online");
                      loadUsers(token);
                  })
                  .catch(err => console.error("❌ SetUserOnline error:", err));
          })
          .catch(err => {
              console.error("❌ Connection failed:", err);
              setConnectionStatus('failed');
          });

      // ⬇️ YENİDEN BAĞLANMA EVENT'LERİ
      newConnection.onreconnecting(() => {
          console.log("🔄 Reconnecting...");
          setConnectionStatus('connecting');
      });

      newConnection.onreconnected(() => {
          console.log("✅ Reconnected");
          setConnectionStatus('connected');
          newConnection.invoke('SetUserOnline')
              .then(() => loadUsers(tokenRef.current))
              .catch(err => console.error("❌ SetUserOnline on reconnect:", err));
      });

      newConnection.onclose(() => {
          console.log("❌ Connection closed");
          setConnectionStatus('disconnected');
      });

      // ⬇️ MESAJ ALMA
      newConnection.on('ReceiveMessage', (msg) => {
          const senderId = msg.senderId || msg.SenderId;
          const myId = getSafeUserId(userRef.current);
          const isMyMsg = String(senderId) === String(myId);
          const isSelected = String(senderId) === String(selectedUserRef.current?.id);
          
          // Kendi mesajımızı ekleme (tempMsg zaten ekledi)
          if (isMyMsg) {
              setUsers(prev => prev.map(u => {
                  if (u.id === selectedUserRef.current?.id) {
                      return { 
                          ...u, 
                          lastMessage: msg.content || '📎 Attachment', 
                          lastMessageTime: msg.sentAt 
                      };
                  }
                  return u;
              }));
              loadUsers(tokenRef.current);
              return;
          }
          
          // Başkasından gelen mesajları işle
          if (isSelected) {
              setMessages(prev => [...prev, msg]); 
              playSound('messageReceived');
              markAsRead(senderId);
          } else {
              playSound('notification');
              showNotification(senderId, msg.senderName, msg.content);
          }
          
          // User listesini güncelle
          setUsers(prev => prev.map(u => {
              if (u.id === senderId) {
                  return {
                      ...u,
                      lastMessage: msg.content || '📎 Attachment',
                      lastMessageTime: msg.sentAt,
                      unreadCount: isSelected ? 0 : (u.unreadCount || 0) + 1
                  };
              }
              return u;
          }));
          
          loadUsers(tokenRef.current);
      });
      
      // ⬇️ ONLINE/OFFLINE EVENT'LERİ
      newConnection.on('UserOnline', (userId) => {
          console.log(`🟢 User ${userId} online`);
          setUsers(prev => prev.map(u => 
              String(u.id) === String(userId) ? { ...u, isOnline: true } : u
          ));
      });
      
      newConnection.on('UserOffline', (userId) => {
          console.log(`⚫ User ${userId} offline`);
          setUsers(prev => prev.map(u => 
              String(u.id) === String(userId) ? { ...u, isOnline: false } : u
          ));
      });
      
      // ⬇️ TYPING EVENT'LERİ
      newConnection.on('UserTyping', (userId) => { 
          if (String(selectedUserRef.current?.id) === String(userId)) {
              setIsTyping(true);
          }
      });
      
      newConnection.on('UserStoppedTyping', (userId) => { 
          if (String(selectedUserRef.current?.id) === String(userId)) {
              setIsTyping(false);
          }
      });

      // ⬇️ CLEANUP: Bağlantıyı kapat ve offline ol
      return () => {
          if (newConnection.state === signalR.HubConnectionState.Connected) {
              newConnection.invoke('SetUserOffline')
                  .catch(err => console.error("❌ SetUserOffline error:", err))
                  .finally(() => {
                      newConnection.stop();
                      console.log("🔌 Connection stopped");
                  });
          } else {
              newConnection.stop();
          }
      };
  }, [token, loadUsers, playSound, showNotification, markAsRead]);

  // ⬇️ SELECTED USER DEĞİŞİNCE MESAJLARI YÜKLE
  useEffect(() => { 
      if (selectedUser && token) {
          loadMessages(selectedUser.id);
          // Typing durumunu sıfırla
          setIsTyping(false);
      }
  }, [selectedUser, token, loadMessages]);

  // ⬇️ TYPING NOTIFICATION
  useEffect(() => {
      if (!messageInput || !selectedUser || !connection) return;
      if (connection.state !== signalR.HubConnectionState.Connected) return;

      // Yazıyor bildirimi gönder
      connection.invoke('NotifyTyping', selectedUser.id).catch(() => {});

      // Timeout ile durmayı bildir
      const timeout = setTimeout(() => {
          if (connection.state === signalR.HubConnectionState.Connected) {
              connection.invoke('StopTyping', selectedUser.id).catch(() => {});
          }
      }, 2000);

      return () => {
          clearTimeout(timeout);
          // Input temizlendiğinde de stop gönder
          if (connection?.state === signalR.HubConnectionState.Connected) {
              connection.invoke('StopTyping', selectedUser.id).catch(() => {});
          }
      };
  }, [messageInput, selectedUser, connection]);

  // ⬇️ TAB GÖRÜNÜRLİK DEĞİŞİNCE (ONLINE/OFFLINE)
  useEffect(() => {
      if (!connection) return;

      const handleVisibilityChange = () => {
          if (connection.state !== signalR.HubConnectionState.Connected) return;

          if (document.hidden) {
              // Tab gizlendiğinde offline
              connection.invoke('SetUserOffline')
                  .then(() => console.log("📱 Tab hidden - offline"))
                  .catch(console.error);
          } else {
              // Tab göründüğünde online
              connection.invoke('SetUserOnline')
                  .then(() => {
                      console.log("📱 Tab visible - online");
                      loadUsers(tokenRef.current);
                  })
                  .catch(console.error);
          }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
  }, [connection, loadUsers]);

  // --- SEND MESSAGE ---
const sendMessage = async (e) => {
    e.preventDefault();
    // Validasyonlar aynı
    if((!messageInput.trim() && !selectedFile) || !selectedUser || !connection) return;
    
    const myId = getSafeUserId(user);
    const content = messageInput.trim();
    
    // --- YENİ: Yanıtlanan mesajın ID'sini al ---
    const replyToId = replyingTo ? replyingTo.id : null;

    let attachmentData = null;

    // --- Dosya Yükleme İşlemi (Aynen Kalıyor) ---
    if(selectedFile) {
        setIsUploading(true);
        const formData = new FormData(); 
        formData.append('file', selectedFile);
        
        try {
            const res = await axios.post(`${API_URL}/files/upload`, formData, {
                headers: { Authorization: `Bearer ${token}` },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
                    setUploadProgress(percent)
                }
            });
            attachmentData = { 
                fileName: res.data.fileName, 
                fileUrl: res.data.url, 
                type: selectedFile.type.startsWith('image/') ? 1 : 4 
            };
            setIsUploading(false);
            setUploadProgress(0);
        } catch(error) {
            showToast('Upload failed', 'error');
            setIsUploading(false);
            setUploadProgress(0);
            return;
        }
    }

    // --- YENİ: tempMsg içine replyMessage ekliyoruz ---
    // Bu sayede backend'den cevap gelmesini beklemeden ekranda yanıtı gösteriyoruz (Optimistic UI)
    const tempMsg = { 
        id: Date.now(), 
        content, 
        senderId: myId, 
        isRead: false, 
        sentAt: new Date().toISOString(), 
        attachments: attachmentData ? [attachmentData] : [],
        // Eğer bir mesaja yanıt veriyorsak, detaylarını buraya ekle:
        replyMessage: replyingTo ? {
            id: replyingTo.id,
            // Gönderen ismini bulmaya çalış, yoksa varsayılan koy
            senderName: replyingTo.senderName || users.find(u => u.id === replyingTo.senderId)?.fullName || 'User',
            content: replyingTo.content || (replyingTo.attachments?.length ? '📎 Attachment' : '')
        } : null
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setMessageInput(''); 
    setSelectedFile(null); 
    
    // --- YENİ: Mesaj gittiği an yanıt modundan çık ---
    setReplyingTo(null); 
    
    playSound('messageSent');

    try {
        // --- YENİ: Backend'e replyToMessageId gönderiyoruz ---
        await connection.invoke('SendMessage', { 
            receiverId: selectedUser.id, 
            content, 
            attachment: attachmentData,
            replyToMessageId: replyToId // Backend bunu bekliyor
        });
    } catch(e) { 
        showToast('Send failed', 'error'); 
        // Hata olursa belki tempMsg'yi silmek veya hata göstermek isteyebilirsin
    }
  };

  const logout = async () => {
     if(connection) try { await connection.stop(); } catch {}
     localStorage.removeItem('token'); 
     localStorage.removeItem('user');
     setToken(null); 
     setUser(null);
  }

  const handleAuthSuccess = (responseData) => {
    const receivedToken = responseData.token || responseData.data?.token || responseData.accessToken;
    const rawUser = responseData.data || responseData.user || responseData; 
    const userData = { 
        id: rawUser.id || rawUser.userId, 
        userName: rawUser.userName, 
        fullName: rawUser.fullName, 
        email: rawUser.email 
    };

    if (receivedToken && userData.id) {
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(receivedToken);
        setUser(userData);
    } else {
        console.error("Auth success but missing data:", responseData);
    }
  };

  // === RENDER ===
  if (!token) return <AuthScreen onAuthSuccess={handleAuthSuccess} />

  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  return (
    <>
      <TitleBar />

      <div className={`flex w-screen bg-bg-main overflow-hidden ${isElectron ? 'h-[calc(100vh-32px)]' : 'h-full'}`}>
        
        <Toast toast={toast} />

        {isMobile && (
          <div 
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40 ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsMobileSidebarOpen(false)} 
          />
        )}

        <Sidebar 
          user={user} 
          users={users} 
          selectedUser={selectedUser} 
          connectionStatus={connectionStatus}
          theme={theme} 
          soundEnabled={soundEnabled} 
          isMobile={isMobile} 
          isMobileSidebarOpen={isMobileSidebarOpen}
          onToggleTheme={() => setTheme(p => p==='dark'?'light':'dark')} 
          onToggleSound={() => setSoundEnabled(p => !p)}
          onProfileClick={() => { setViewProfileUserId(null); setShowProfilePage(true) }}
          onLogout={logout} 
          onSelectUser={handleSelectUser}
          onContextMenu={(e, u) => { e.preventDefault(); setViewProfileUserId(u.id); setShowProfilePage(true) }}
        />
        
        <div className="flex-1 relative flex flex-col h-full overflow-hidden">
          {showProfilePage ? (
            <ProfilePage 
              user={viewProfileUserId ? users.find(u => u.id === viewProfileUserId) : user} 
              token={token} 
              API_URL={API_URL} 
              currentUserId={getSafeUserId(user)}
              onClose={() => setShowProfilePage(false)} 
              showToast={showToast}
            />
          ) : (
            <ChatWindow 
              selectedUser={selectedUser} 
              messages={messages} 
              messageInput={messageInput} 
              setMessageInput={setMessageInput}
              sendMessage={sendMessage} 
              onInitiateCall={handleInitiateCall} 
              onImageClick={setLightboxImage}
              isTyping={isTyping} 
              connectionStatus={connectionStatus} 
              isMobile={isMobile}
              onMobileMenuOpen={() => setIsMobileSidebarOpen(true)}
              onProfileView={() => { setViewProfileUserId(selectedUser.id); setShowProfilePage(true) }}
              callStatus={callStatus} 
              selectedFile={selectedFile} 
              setSelectedFile={setSelectedFile}
              isUploading={isUploading} 
              uploadProgress={uploadProgress} 
              isCompressing={isCompressing}
              currentUserId={getSafeUserId(user)} 
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
            />
          )}
        </div>

        {callStatus === 'ringing' && activeCall?.initiatorId !== getSafeUserId(user) && (
          <IncomingCallModal call={activeCall} onAccept={acceptCall} onDecline={declineCall} />
        )}

        {callStatus === 'ringing' && activeCall?.initiatorId === getSafeUserId(user) && (
          <OutgoingCallScreen 
            call={activeCall}
            users={users}
            currentUserId={getSafeUserId(user)}
            onEndCall={endCall}
          />
        )}

        {callStatus === 'active' && (
          <ActiveCallScreen 
            localStream={localStream} 
            remoteStream={remoteStream} 
            activeCall={activeCall}
            currentUserId={getSafeUserId(user)}
            allUsers={users}
            onEndCall={endCall} 
            onToggleAudio={toggleAudio} 
            onToggleVideo={toggleVideo} 
          />
        )}
        
        <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />
      </div>
    </>
  )
}

export default App