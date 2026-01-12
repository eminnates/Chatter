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
import TitleBar from './components/Common/TitleBar'

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
  
  // --- REPLY STATE ---
  const [replyingTo, setReplyingTo] = useState(null)
  
  const [lightboxImage, setLightboxImage] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isCompressing, setIsCompressing] = useState(false)
  const [toast, setToast] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
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
  const soundEnabledRef = useRef(soundEnabled);

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

  // === LOGOUT ===
  const logout = async () => {
     if(connection) try { await connection.stop(); } catch {}
     localStorage.removeItem('token'); 
     localStorage.removeItem('user');
     setToken(null); 
     setUser(null);
  }

  // === SOUND ===
  const playSound = useCallback((soundName) => {
    // soundEnabled yerine soundEnabledRef.current kullanıyoruz
    if (soundEnabledRef.current && sounds[soundName]) {
      sounds[soundName]();
    }
  }, []);

  // === DATA LOADERS ===
  const loadUsers = useCallback(async (activeToken) => {
    if (!activeToken) return;

    try {
      console.log("🚀 Kullanıcılar yükleniyor...");
      const { data } = await axios.get(`${API_URL}/user`, { headers: { Authorization: `Bearer ${activeToken}` } })
      const userList = Array.isArray(data) ? data : (data.data || []);
      
      setUsers(userList);

      const usersWithLastMessages = await Promise.all(userList.map(async (u) => {
        try {
          let convId = u.conversationId; 
          if (!convId) {
             const convRes = await axios.post(`${API_URL}/chat/conversation/${u.id}`, {}, { 
                headers: { Authorization: `Bearer ${activeToken}` } 
             });
             convId = convRes.data.value || convRes.data.id || convRes.data;
          }

          if (convId) {
            try {
                const lastMsgRes = await axios.get(`${API_URL}/chat/last-message/${convId}`, {
                  headers: { Authorization: `Bearer ${activeToken}` }
                });
                
                const rawData = lastMsgRes.data;
                const lastMsg = rawData.data || rawData.value || rawData;

                if (lastMsg) {
                  const content = lastMsg.content || lastMsg.Content;
                  const attachments = lastMsg.attachments || lastMsg.Attachments;
                  const sentAt = lastMsg.sentAt || lastMsg.SentAt;

                  return {
                    ...u,
                    lastMessage: content || (attachments?.length > 0 ? '📷 Photo' : 'Message'),
                    lastMessageTime: sentAt
                  };
                }
            } catch (msgError) {
                // 404 Mesaj yok, normal.
            }
          }
        } catch (err) {
           console.error(`User process error for ${u.userName}:`, err);
        }
        return u;
      }));

      setUsers(usersWithLastMessages);
    } catch (error) {
       console.error("Load users fatal error:", error);
       if (error.response?.status === 401) logout();
    }
  }, []);

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

  const requestNotificationPermission = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      try { await LocalNotifications.requestPermissions() } catch (err) {}
    } else {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    }
  }, [])

  const showNotification = useCallback(async (senderId, senderName, messageContent) => {
    await triggerHaptic(ImpactStyle.Light)
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'granted') {
       const notif = new Notification(senderName, { 
         body: messageContent, 
         icon: '/icon.png',
         silent: true 
       });
       notif.onclick = () => {
         window.focus();
         const targetUser = usersRef.current.find(u => u.id === senderId);
         if (targetUser) handleSelectUser(targetUser);
         notif.close();
       };
    }
  }, [handleSelectUser])

  // === REFS & LISTENERS ===
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

  useEffect(() => {
    const init = async () => {
        if(Capacitor.isNativePlatform()) {
            document.body.classList.add('is-mobile');
            await SplashScreen.hide();
            await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});
            
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

            CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                if(lightboxImageRef.current) { setLightboxImage(null); return; }
                if(isMobileSidebarOpenRef.current) { setIsMobileSidebarOpen(false); return; }
                if(showProfilePageRef.current) { setShowProfilePage(false); return; }
                if(!canGoBack) CapacitorApp.exitApp(); else window.history.back();
            });

            if (Capacitor.getPlatform() === 'android') {
                setTimeout(() => { checkAndroidUpdate(showToast); }, 3000);
            }
        }
        if (window.electronAPI?.isElectron) document.body.classList.add('is-electron');
    }
    init();
  }, [loadUsers, showToast]);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      if (isFirstConnection) setIsFirstConnection(false)
      else { showToast('Reconnected', 'success'); playSound('connect') }
    } else if (connectionStatus === 'failed') {
      showToast('Connection lost. Retrying...', 'error')
    }
  }, [connectionStatus, isFirstConnection, showToast, playSound])

  useEffect(() => {
    document.documentElement.classList.add('theme-transitioning')
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    setTimeout(() => { document.documentElement.classList.remove('theme-transitioning') }, 300)
  }, [theme])

  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth <= 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    if (token && !localStorage.getItem('notificationAsked')) {
      setTimeout(() => {
        requestNotificationPermission()
        localStorage.setItem('notificationAsked', 'true')
      }, 3000)
    }
  }, [token, requestNotificationPermission])

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
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
          .withAutomaticReconnect()
          .configureLogging(signalR.LogLevel.Information)
          .build();

      newConnection.start()
          .then(() => {
              setConnection(newConnection);
              setConnectionStatus('connected');
              newConnection.invoke('SetUserOnline').then(() => loadUsers(token)).catch(console.error);
          })
          .catch(err => {
              console.error("❌ Connection failed:", err);
              setConnectionStatus('failed');
          });

      newConnection.onreconnected(() => {
          setConnectionStatus('connected');
          newConnection.invoke('SetUserOnline').then(() => loadUsers(tokenRef.current));
      });

      newConnection.onclose(() => setConnectionStatus('disconnected'));

      newConnection.on('ReceiveMessage', (msg) => {
          const senderId = msg.senderId || msg.SenderId;
          const myId = getSafeUserId(userRef.current);
          const isMyMsg = String(senderId) === String(myId);
          const isSelected = String(senderId) === String(selectedUserRef.current?.id);
          
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
          
          if (isSelected) {
              setMessages(prev => [...prev, msg]); 
              playSound('messageReceived');
              markAsRead(senderId);
          } else {
              playSound('notification');
              showNotification(senderId, msg.senderName, msg.content);
          }
          
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
      
      newConnection.on('UserOnline', (userId) => {
          setUsers(prev => prev.map(u => String(u.id) === String(userId) ? { ...u, isOnline: true } : u));
      });
      
      newConnection.on('UserOffline', (userId) => {
          setUsers(prev => prev.map(u => String(u.id) === String(userId) ? { ...u, isOnline: false } : u));
      });
      
      newConnection.on('UserTyping', (userId) => { 
          if (String(selectedUserRef.current?.id) === String(userId)) setIsTyping(true);
      });
      
      newConnection.on('UserStoppedTyping', (userId) => { 
          if (String(selectedUserRef.current?.id) === String(userId)) setIsTyping(false);
      });

      return () => {
          if (newConnection.state === signalR.HubConnectionState.Connected) {
              newConnection.invoke('SetUserOffline').catch(console.error).finally(() => newConnection.stop());
          } else {
              newConnection.stop();
          }
      };
  }, [token, loadUsers, playSound, showNotification, markAsRead]);

  useEffect(() => { 
      if (selectedUser && token) {
          loadMessages(selectedUser.id);
          setIsTyping(false);
      }
  }, [selectedUser, token, loadMessages]);

  // Typing Notification
  useEffect(() => {
      if (!messageInput || !selectedUser || !connection || connection.state !== signalR.HubConnectionState.Connected) return;
      connection.invoke('NotifyTyping', selectedUser.id).catch(() => {});
      const timeout = setTimeout(() => {
          if (connection.state === signalR.HubConnectionState.Connected) connection.invoke('StopTyping', selectedUser.id).catch(() => {});
      }, 2000);
      return () => {
          clearTimeout(timeout);
          if (connection?.state === signalR.HubConnectionState.Connected) connection.invoke('StopTyping', selectedUser.id).catch(() => {});
      };
  }, [messageInput, selectedUser, connection]);

  // Tab Visibility
  useEffect(() => {
      if (!connection) return;
      const handleVisibilityChange = () => {
          if (connection.state !== signalR.HubConnectionState.Connected) return;
          if (document.hidden) connection.invoke('SetUserOffline').catch(console.error);
          else connection.invoke('SetUserOnline').then(() => loadUsers(tokenRef.current)).catch(console.error);
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connection, loadUsers]);

  // === SEND MESSAGE FUNCTION (OPTIMIZED FOR REPLY) ===
  const sendMessage = async (e) => {
    e.preventDefault();
    if((!messageInput.trim() && !selectedFile) || !selectedUser || !connection) return;
    
    const myId = getSafeUserId(user);
    const content = messageInput.trim();
    
    // 1. Yanıtlanacak ID'yi sakla
    const replyToId = replyingTo ? replyingTo.id : null;

    let attachmentData = null;

    if(selectedFile) {
        setIsUploading(true);
        const formData = new FormData(); 
        formData.append('file', selectedFile);
        
        try {
            const res = await axios.post(`${API_URL}/files/upload`, formData, {
                headers: { Authorization: `Bearer ${token}` },
                onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded * 100) / p.total))
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
            return;
        }
    }

    // 2. Optimistic UI için geçici mesaj oluştur
    const tempMsg = { 
        id: Date.now(), 
        content, 
        senderId: myId, 
        isRead: false, 
        sentAt: new Date().toISOString(), 
        attachments: attachmentData ? [attachmentData] : [],
        // Alıntılanan mesajı UI'da hemen göster
        replyMessage: replyingTo ? {
            id: replyingTo.id,
            // Gönderen ismi yoksa user listesinden bul
            senderName: replyingTo.senderName || users.find(u => u.id === replyingTo.senderId)?.fullName || 'User',
            // İçerik yoksa (sadece fotoyse) belirteç koy
            content: replyingTo.content || (replyingTo.attachments?.length ? '📷 Photo' : '')
        } : null
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setMessageInput(''); 
    setSelectedFile(null); 
    setReplyingTo(null); // Mesaj gittiği an reply modundan çık
    
    playSound('messageSent');

    try {
        await connection.invoke('SendMessage', { 
            receiverId: selectedUser.id, 
            content, 
            attachment: attachmentData,
            replyToMessageId: replyToId // Backend DTO ile eşleşmeli
        });
    } catch(e) { 
        showToast('Send failed', 'error'); 
        console.error(e);
    }
  };

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
    }
  };

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