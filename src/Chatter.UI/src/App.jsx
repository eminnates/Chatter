import { isTauri } from "@tauri-apps/api/core";
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import * as signalR from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import axios from 'axios';
import './index.css'

// --- CONFIG & UTILS ---
import { API_URL, HUB_URL } from './config/constants'
import { sounds } from './utils/soundManager'
import { checkForUpdate, downloadAndInstallUpdate } from './utils/androidUpdater';
import { compressMedia } from './utils/mediaCompression';

// --- COMPONENTS (Eager loaded - critical path) ---
import AuthScreen from './components/Auth/AuthScreen'
import Sidebar from './components/Chat/Sidebar'
import ChatWindow from './components/Chat/ChatWindow'
import Toast from './components/Common/Toast'
import ConnectionBanner from './components/Common/ConnectionBanner'
const TitleBar = lazy(() => import('./components/Common/TitleBar'))
import ErrorBoundary from './components/Common/ErrorBoundary'
import UpdateModal from './components/Common/UpdateModal'

// --- COMPONENTS (Lazy loaded - reduces initial bundle ~30%) ---
const IncomingCallModal = lazy(() => import('./components/Call/IncomingCallModal'))
const ActiveCallScreen = lazy(() => import('./components/Call/ActiveCallScreen'))
const OutgoingCallScreen = lazy(() => import('./components/Call/OutgoingCallScreen'))
const ProfilePage = lazy(() => import('./components/Profile/ProfilePage'))
const Lightbox = lazy(() => import('./components/Common/Lightbox'))

// --- UTILS ---
import { storage } from './utils/storage'

// --- HOOKS ---
import { useWebRTC } from './hooks/useWebRTC'
import { useRegisterSW } from 'virtual:pwa-register/react'

// --- NATIVE & ICONS ---
import { App as CapacitorApp } from '@capacitor/app'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { SplashScreen } from '@capacitor/splash-screen'
import { Network } from '@capacitor/network'

// Axios Config
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

// --- TOKEN REFRESH INTERCEPTOR ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Bu fonksiyon App içinden setToken/setUser/logout ref'lerini alacak
let _tokenRefreshCallbacks = { getToken: () => null, setToken: null, setUser: null, logout: null, tokenRef: null };

export const setTokenRefreshCallbacks = (cbs) => { _tokenRefreshCallbacks = cbs; };

axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(newToken => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axios(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const storedRefreshToken = await storage.get('refreshToken');
        if (!storedRefreshToken) {
          _tokenRefreshCallbacks.logout?.();
          processQueue(new Error('No refresh token'), null);
          return Promise.reject(error);
        }

        const currentToken = _tokenRefreshCallbacks.tokenRef?.current;
        const { data } = await axios.post(`${API_URL}/auth/refresh`,
          { refreshToken: storedRefreshToken },
          {
            headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
            _retry: true // interceptor'ın bu isteği tekrar yakalamasını engelle
          }
        );

        const newToken = data.token;
        const newRefreshToken = data.refreshToken;

        await storage.set('token', newToken);
        await storage.set('refreshToken', newRefreshToken);

        if (_tokenRefreshCallbacks.tokenRef) _tokenRefreshCallbacks.tokenRef.current = newToken;
        _tokenRefreshCallbacks.setToken?.(newToken);

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        _tokenRefreshCallbacks.logout?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// --- HAPTIC HELPER ---
const triggerHaptic = async (style = ImpactStyle.Light) => {
  if (Capacitor.isNativePlatform()) {
    try { await Haptics.impact({ style }) } catch (e) { console.log('Haptics unavailable') }
  }
}

function App() {
  // === STATES ===
  const [token, setToken] = useState(() => storage.getSync('token'))
  const [user, setUser] = useState(() => {
    try { return JSON.parse(storage.getSync('user')) } catch { return null }
  })

  const [theme, setTheme] = useState(() => storage.getSync('theme') || 'dark')
  const [soundEnabled, setSoundEnabled] = useState(() => storage.getSync('soundEnabled') !== 'false')

  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [connection, setConnection] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [selectedFile, setSelectedFile] = useState(null)

  // --- REPLY STATE ---
  const [replyingTo, setReplyingTo] = useState(null)

  // --- SEARCH STATE ---
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

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
  const [isNetworkOnline, setIsNetworkOnline] = useState(true)

  // --- PWA UPDATE ---
  const { needRefresh: [pwaUpdateReady], updateServiceWorker } = useRegisterSW()

  // --- UPDATE STATE ---
  const [updateInfo, setUpdateInfo] = useState(null)
  const [updateStatus, setUpdateStatus] = useState('idle')
  const [updateProgress, setUpdateProgress] = useState({ percent: 0, bytesDownloaded: 0, totalBytes: 0 })
  const [updateError, setUpdateError] = useState(null)

  // === REFS ===
  const messageQueueRef = useRef([]);
  const lastMessageTimestampRef = useRef(null); // reconnect catch-up için
  const selectedUserRef = useRef(null)
  const userRef = useRef(user)
  const usersRef = useRef(users)
  const connectionRef = useRef(connection);
  const tokenRef = useRef(token);
  const lightboxImageRef = useRef(lightboxImage);
  const isMobileSidebarOpenRef = useRef(isMobileSidebarOpen);
  const showProfilePageRef = useRef(showProfilePage);
  const soundEnabledRef = useRef(soundEnabled);
  const typingTimeoutRef = useRef(null);
  const reactionDebounceRef = useRef({});

  // === NATIVE STORAGE HYDRATION ===
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      const nativeToken = await storage.get('token');
      const nativeUser = await storage.get('user');
      if (nativeToken && !token) setToken(nativeToken);
      if (nativeUser && !user) {
        try { setUser(JSON.parse(nativeUser)); } catch {}
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // === TOKEN REFRESH CALLBACK BAĞLAMA ===
  useEffect(() => {
    setTokenRefreshCallbacks({ tokenRef, setToken, setUser, logout: () => {
      if (connectionRef.current) try { connectionRef.current.stop(); } catch {}
      storage.remove('token');
      storage.remove('user');
      storage.remove('refreshToken');
      setToken(null);
      setUser(null);
    }});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // === UPDATE HANDLER ===
  const handleUpdate = useCallback(async () => {
    if (!updateInfo?.apkUrl) return;

    if (updateStatus === 'downloaded') {
      // Re-trigger install
      setUpdateStatus('installing');
      try {
        await downloadAndInstallUpdate(updateInfo.apkUrl, () => {});
      } catch (e) {
        if (e.message === 'PERMISSION_NEEDED') {
          setUpdateStatus('idle');
          showToast('Bilinmeyen kaynaklardan kuruluma izin verin, sonra tekrar deneyin.', 'warning');
        } else {
          setUpdateStatus('error');
          setUpdateError(e.message);
        }
      }
      return;
    }

    setUpdateStatus('downloading');
    setUpdateProgress({ percent: 0, bytesDownloaded: 0, totalBytes: 0 });
    setUpdateError(null);

    try {
      await downloadAndInstallUpdate(updateInfo.apkUrl, (percent, bytesDownloaded, totalBytes) => {
        setUpdateProgress({ percent, bytesDownloaded, totalBytes });
        if (percent >= 100) setUpdateStatus('installing');
      });
    } catch (e) {
      if (e.message === 'PERMISSION_NEEDED') {
        setUpdateStatus('idle');
        showToast('Bilinmeyen kaynaklardan kuruluma izin verin, sonra tekrar deneyin.', 'warning');
      } else {
        setUpdateStatus('error');
        setUpdateError(e.message);
      }
    }
  }, [updateInfo, updateStatus, showToast]);

  const handleCloseUpdate = useCallback(() => {
    setUpdateInfo(null);
    setUpdateStatus('idle');
    setUpdateProgress({ percent: 0, bytesDownloaded: 0, totalBytes: 0 });
    setUpdateError(null);
  }, []);

  // === LOGOUT ===
  const logout = useCallback(async () => {
    if (connection) try { await connection.stop(); } catch { }
    await storage.remove('token');
    await storage.remove('user');
    await storage.remove('refreshToken');
    setToken(null);
    setUser(null);
  }, [connection]);

  // === SOUND ===
  const playSound = useCallback((soundName) => {
    // soundEnabled yerine soundEnabledRef.current kullanıyoruz
    if (soundEnabledRef.current && sounds[soundName]) {
      sounds[soundName]();
    }
  }, []);

  // === DATA LOADERS ===
  // loadUsers: Single API call that returns users + their last message + unread count.
  // Previously this was N+1: 1 call for users, then 1 call per user for conversation + last message.
  // For 50 users, that was 101 HTTP requests. Now it's 1.
  const loadUsers = useCallback(async (activeToken) => {
    if (!activeToken) return;
    setIsLoadingUsers(true);
    try {
      const { data } = await axios.get(`${API_URL}/user/with-conversations`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const userList = Array.isArray(data) ? data : (data.data || data.value || []);

      const selectedId = selectedUserRef.current?.id;
      setUsers(userList.map(u => {
        const isCurrentlySelected = selectedId && String(u.id) === String(selectedId);
        return {
          ...u,
          lastMessage: u.lastMessage || '',
          lastMessageTime: u.lastMessageAt || u.lastMessageTime,
          unreadCount: isCurrentlySelected ? 0 : (u.unreadCount || 0)
        };
      }));
    } catch (error) {
      console.error("Load users error:", error);
    } finally {
      setIsLoadingUsers(false);
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
    } catch (e) { }
  }, [token])

  // === ACTIONS ===
  const handleSelectUser = useCallback((u) => {
    setSelectedUser(u);
    setMessages([]);
    setIsTyping(false);
    setReplyingTo(null);
    setSearchResults(null);
    setIsSearching(false);
    markAsRead(u.id);
    if (isMobile) setIsMobileSidebarOpen(false);
  }, [markAsRead, isMobile]);

  const showNotification = useCallback(async (senderId, senderName, messageContent) => {
    await triggerHaptic(ImpactStyle.Light)
    if (Capacitor.isNativePlatform()) {
      // Capacitor local notification with tap handler
      await LocalNotifications.schedule({
        notifications: [{
          title: senderName,
          body: messageContent,
          id: Date.now(),
          extra: { senderId }
        }]
      }).catch(() => {});
    } else if ('Notification' in window) {
      // Only show browser notification when the tab is in the background
      if (!document.hidden) return;

      if (Notification.permission === 'default' && !storage.getSync('notificationAsked')) {
        // Contextual prompt: ask for permission only when a background message actually arrives
        storage.set('notificationAsked', 'true')
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return;
      }

      if (Notification.permission === 'granted') {
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

  // Sync selectedUser with users array (e.g. when online status changes)
  useEffect(() => {
    if (!selectedUser) return;
    const updated = users.find(u => String(u.id) === String(selectedUser.id));
    if (updated && (updated.isOnline !== selectedUser.isOnline || updated.fullName !== selectedUser.fullName)) {
      setSelectedUser(prev => ({ ...prev, ...updated }));
    }
  }, [users]);

  useEffect(() => {
    const init = async () => {
      if (Capacitor.isNativePlatform()) {
        document.body.classList.add('is-mobile');
        await SplashScreen.hide();
        await Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => { });

        CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
          setIsAppActive(isActive);
          const conn = connectionRef.current;
          if (!conn) return;
          if (!isActive && conn.state === signalR.HubConnectionState.Connected) {
            conn.invoke('SetUserOffline').catch(console.error);
          } else if (isActive && conn.state === signalR.HubConnectionState.Disconnected) {
            await conn.start();
            conn.invoke('SetUserOnline');
            if (tokenRef.current) loadUsers(tokenRef.current);
          }
        });

        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (lightboxImageRef.current) { setLightboxImage(null); return; }
          if (isMobileSidebarOpenRef.current) { setIsMobileSidebarOpen(false); return; }
          if (showProfilePageRef.current) { setShowProfilePage(false); return; }
          if (!canGoBack) CapacitorApp.exitApp(); else window.history.back();
        });

        // Notification tap handler
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          const senderId = notification.notification?.extra?.senderId;
          if (senderId) {
            const targetUser = usersRef.current.find(u => u.id === senderId);
            if (targetUser) handleSelectUser(targetUser);
          }
        });

        if (Capacitor.getPlatform() === 'android') {
          setTimeout(async () => {
            const result = await checkForUpdate();
            if (result.hasUpdate) {
              setUpdateInfo(result);
              setUpdateStatus('idle');
            }
          }, 3000);
        }
      }
      if (isTauri()) document.body.classList.add('is-desktop');

      // Network durumu algılama (tüm platformlar)
      Network.addListener('networkStatusChange', (status) => {
        setIsNetworkOnline(status.connected);
        if (status.connected) {
          // Bağlantı geldiğinde kuyruktaki mesajları gönder
          const conn = connectionRef.current;
          if (conn?.state === signalR.HubConnectionState.Connected && messageQueueRef.current.length > 0) {
            const queue = [...messageQueueRef.current];
            messageQueueRef.current = [];
            queue.forEach(msg => {
              conn.invoke('SendMessage', msg).catch(console.error);
            });
          }
        }
      });
      // İlk yüklemede network durumunu oku
      Network.getStatus().then(s => setIsNetworkOnline(s.connected));
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
    storage.set('theme', theme)
    setTimeout(() => { document.documentElement.classList.remove('theme-transitioning') }, 300)
  }, [theme])

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Notification permission is requested contextually (see showNotification),
  // not automatically on login — avoids browser prompt appearing out of context.

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  // === WEBRTC ===
  const { localStream, remoteStream, callStatus, activeCall, connectionQuality, initiateCall, acceptCall, declineCall, endCall, toggleAudio, toggleVideo } = useWebRTC(connection, getSafeUserId(user), showToast, showNotification)

  const handleInitiateCall = useCallback((receiverId, callType) => {
    const myId = getSafeUserId(user);
    if (String(receiverId).toLowerCase() === String(myId).toLowerCase()) { showToast('Cannot call yourself', 'error'); return }
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
        accessTokenFactory: () => tokenRef.current,
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    newConnection.start()
      .then(() => {
        setConnection(newConnection);
        setConnectionStatus('connected');
        newConnection.invoke('SetUserOnline').then(() => loadUsers(token)).catch(console.error);
        // Kuyruktaki mesajları gönder
        if (messageQueueRef.current.length > 0) {
          const queue = [...messageQueueRef.current];
          messageQueueRef.current = [];
          queue.forEach(msg => newConnection.invoke('SendMessage', msg).catch(console.error));
        }
      })
      .catch(err => {
        console.error("❌ Connection failed:", err);
        setConnectionStatus('failed');
      });

    newConnection.onreconnected(async () => {
      setConnectionStatus('connected');
      try {
        newConnection.invoke('SetUserOnline').catch(() => {});
        loadUsers(tokenRef.current);

        // Reconnect catch-up: bağlantı kesilirken kaçırılan mesajları al
        const selected = selectedUserRef.current;
        const lastTs = lastMessageTimestampRef.current;
        if (selected && lastTs) {
          try {
            const convRes = await axios.post(
              `${API_URL}/chat/conversation/${selected.id}`, {},
              { headers: { Authorization: `Bearer ${tokenRef.current}` } }
            );
            const convId = convRes.data.value || convRes.data.id || convRes.data;
            if (convId) {
              const since = lastTs.toISOString();
              const { data } = await axios.get(
                `${API_URL}/chat/messages/${convId}/since?timestamp=${encodeURIComponent(since)}`,
                { headers: { Authorization: `Bearer ${tokenRef.current}` } }
              );
              const missed = Array.isArray(data) ? data : (data.data || data.value || []);
              if (missed.length > 0) {
                setMessages(prev => {
                  const existingIds = new Set(prev.map(m => String(m.id)));
                  const newOnes = missed.filter(m => !existingIds.has(String(m.id)));
                  return newOnes.length > 0 ? [...prev, ...newOnes].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt)) : prev;
                });
              }
            }
          } catch (catchupErr) {
            console.warn('Reconnect catch-up failed:', catchupErr);
          }
        }
      } catch (err) {
        console.warn('Reconnect handler error:', err);
      }
    });

    newConnection.onclose(() => setConnectionStatus('disconnected'));

    newConnection.on('ReceiveMessage', (rawMsg) => {
      // Normalize MessagePack's PascalCase to camelCase
      const msg = {
        ...rawMsg,
        id: rawMsg.id || rawMsg.Id,
        conversationId: rawMsg.conversationId || rawMsg.ConversationId,
        senderId: rawMsg.senderId || rawMsg.SenderId,
        senderName: rawMsg.senderName || rawMsg.SenderName,
        content: rawMsg.content || rawMsg.Content || '',
        type: rawMsg.type || rawMsg.Type,
        sentAt: rawMsg.sentAt || rawMsg.SentAt,
        isRead: rawMsg.isRead !== undefined ? rawMsg.isRead : (rawMsg.IsRead || false),
        replyToMessageId: rawMsg.replyToMessageId || rawMsg.ReplyToMessageId,
        replyMessage: rawMsg.replyMessage || rawMsg.ReplyMessage,
        attachments: (rawMsg.attachments || rawMsg.Attachments || []).map(a => ({
          id: a.id || a.Id,
          fileName: a.fileName || a.FileName,
          fileUrl: a.fileUrl || a.FileUrl,
          type: a.type || a.Type,
          fileSize: a.fileSize || a.FileSize,
          mimeType: a.mimeType || a.MimeType,
        })),
        reactions: (rawMsg.reactions || rawMsg.Reactions || []).map(r => ({
          userId: r.userId || r.UserId,
          emoji: r.emoji || r.Emoji,
        })),
        error: rawMsg.error || rawMsg.Error || false,
        sending: rawMsg.sending || rawMsg.Sending || false,
        clientMessageId: rawMsg.clientMessageId || rawMsg.ClientMessageId || null
      };

      // Reconnect catch-up için son mesaj zamanını güncelle
      if (msg.sentAt) {
        const ts = new Date(msg.sentAt);
        if (!lastMessageTimestampRef.current || ts > lastMessageTimestampRef.current) {
          lastMessageTimestampRef.current = ts;
        }
      }

      const senderId = msg.senderId;
      const myId = getSafeUserId(userRef.current);
      const isMyMsg = String(senderId) === String(myId);
      const isSelected = String(senderId) === String(selectedUserRef.current?.id);

      if (isMyMsg) {
        // Optimistik mesajı backend'den dönen gerçek mesajla değiştir
        setMessages(prev => {
          const msgId = msg.id;
          // 1. ClientMessageId ile kesin eşleştirme
          if (msg.clientMessageId) {
            const tempIdx = prev.findIndex(m => m._clientMessageId === msg.clientMessageId);
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = msg;
              return updated;
            }
          }
          // 2. Fallback: eski yöntem (clientMessageId olmayan mesajlar için)
          const tempIdx = prev.findIndex(m =>
            typeof m.id === 'number' && m.content === msg.content && String(m.senderId) === String(myId)
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }
          // Duplikasyon kontrolü
          if (msgId && prev.some(m => String(m.id) === String(msgId))) return prev;
          return prev;
        });
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
        return;
      }

      if (isSelected) {
        setMessages(prev => {
          // Deduplication: eğer bu mesaj zaten varsa ekleme
          const msgId = msg.id;
          if (msgId && prev.some(m => String(m.id) === String(msgId))) return prev;
          // ClientMessageId ile optimistik eşleştirme
          if (msg.clientMessageId) {
            const tempIdx = prev.findIndex(m => m._clientMessageId === msg.clientMessageId);
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = msg;
              return updated;
            }
          }
          // Fallback: eski yöntem
          const tempIdx = prev.findIndex(m =>
            typeof m.id === 'number' && m.content === msg.content && String(m.senderId) === String(msg.senderId)
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }
          return [...prev, msg];
        });
        if (msg.type !== 'System' && String(msg.type) !== '2') {
          playSound('messageReceived');
        }
        markAsRead(senderId);
      } else {
        if (msg.type !== 'System' && String(msg.type) !== '2') {
          playSound('notification');
          showNotification(senderId, msg.senderName, msg.content);
        }
      }

      setUsers(prev => prev.map(u => {
        if (u.id === senderId) {
          const isSystemMsg = msg.type === 'System' || String(msg.type) === '2';
          return {
            ...u,
            lastMessage: msg.content || '📎 Attachment',
            lastMessageTime: msg.sentAt,
            unreadCount: isSelected ? 0 : isSystemMsg ? (u.unreadCount || 0) : (u.unreadCount || 0) + 1
          };
        }
        return u;
      }));
    });

    newConnection.on('UserOnline', (userId) => {
      setUsers(prev => prev.map(u => String(u.id) === String(userId) ? { ...u, isOnline: true } : u));
    });

    newConnection.on('UserOffline', (userId) => {
      setUsers(prev => prev.map(u => String(u.id) === String(userId) ? { ...u, isOnline: false } : u));
    });

    newConnection.on('UserTyping', (userId) => {
      if (String(selectedUserRef.current?.id) === String(userId)) {
        setIsTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 5000);
      }
    });

    newConnection.on('UserStoppedTyping', (userId) => {
      if (String(selectedUserRef.current?.id) === String(userId)) {
        clearTimeout(typingTimeoutRef.current);
        setIsTyping(false);
      }
    });

    newConnection.on('ErrorMessage', (error) => {
      console.error('SignalR error:', error);
    });

    // --- MESSAGE EDITED ---
    newConnection.on('MessageEdited', (edited) => {
      const msgId = edited.id || edited.Id;
      setMessages(prev => prev.map(m =>
        String(m.id) === String(msgId)
          ? { ...m, content: edited.content || edited.Content, editedAt: edited.editedAt || edited.EditedAt }
          : m
      ));
    });

    // --- REACTIONS ---
    newConnection.on('ReactionAdded', (data) => {
      const { messageId, userId, emoji } = data;
      setMessages(prev => prev.map(m => {
        if (String(m.id) !== String(messageId)) return m;
        const existing = (m.reactions || []);
        // Remove any previous reaction by this user on this message
        const withoutUser = existing.filter(r => String(r.userId) !== String(userId));
        return { ...m, reactions: [...withoutUser, { userId, emoji }] };
      }));
    });

    newConnection.on('ReactionRemoved', (data) => {
      const { messageId, userId, emoji } = data;
      setMessages(prev => prev.map(m => {
        if (String(m.id) !== String(messageId)) return m;
        return {
          ...m,
          reactions: (m.reactions || []).filter(r =>
            !(String(r.userId) === String(userId) && r.emoji === emoji)
          )
        };
      }));
    });

    return () => {
      if (newConnection.state === signalR.HubConnectionState.Connected) {
        newConnection.invoke('SetUserOffline').catch(console.error).finally(() => newConnection.stop());
      } else {
        newConnection.stop();
      }
    };
  }, [token, loadUsers, playSound, showNotification, markAsRead]);

  const selectedUserId = selectedUser?.id;
  useEffect(() => {
    if (selectedUserId && token) {
      loadMessages(selectedUserId);
      setIsTyping(false);
    }
  }, [selectedUserId, token, loadMessages]);

  // Typing Notification with client-side debounce.
  // Without debounce: every keystroke sends a WebSocket frame (~5 frames/sec at 60 WPM).
  // With debounce: first keystroke sends immediately, subsequent ones are suppressed for 1 second.
  // Combined with server-side throttling, this reduces typing frames by ~90%.
  const typingSentRef = useRef(false);
  const typingDebounceRef = useRef(null);
  useEffect(() => {
    if (!messageInput || !selectedUser || !connection || connection.state !== signalR.HubConnectionState.Connected) return;

    // Only send NotifyTyping if we haven't sent one recently (1 second debounce)
    if (!typingSentRef.current) {
      typingSentRef.current = true;
      connection.invoke('NotifyTyping', selectedUser.id).catch(() => { });
      setTimeout(() => { typingSentRef.current = false; }, 1000);
    }

    // Reset the "stopped typing" timer on every keystroke
    clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      typingSentRef.current = false;
      if (connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke('NotifyStoppedTyping', selectedUser.id).catch(() => { });
      }
    }, 2000);

    return () => {
      clearTimeout(typingDebounceRef.current);
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

  // === EDIT MESSAGE ===
  const handleEditMessage = useCallback(async (messageId, newContent) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      showToast('Not connected', 'error');
      return;
    }
    // Orijinal content'i sakla (rollback için)
    const originalMsg = messages.find(m => String(m.id) === String(messageId));
    const originalContent = originalMsg?.content;

    // Optimistic update
    setMessages(prev => prev.map(m =>
      String(m.id) === String(messageId)
        ? { ...m, content: newContent, editedAt: new Date().toISOString() }
        : m
    ));
    try {
      await connection.invoke('EditMessage', messageId, newContent);
    } catch (e) {
      // Rollback
      setMessages(prev => prev.map(m =>
        String(m.id) === String(messageId)
          ? { ...m, content: originalContent, editedAt: originalMsg?.editedAt }
          : m
      ));
      showToast('Edit failed', 'error');
      console.error(e);
    }
  }, [connection, showToast, messages]);

  // === REACTIONS ===
  const handleAddReaction = useCallback(async (messageId, emoji) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    const key = `${messageId}-${emoji}`;
    if (reactionDebounceRef.current[key]) return;
    reactionDebounceRef.current[key] = true;
    setTimeout(() => { delete reactionDebounceRef.current[key]; }, 200);
    try {
      await connection.invoke('AddReaction', messageId, emoji);
    } catch (e) {
      showToast('Reaction failed', 'error');
      console.error(e);
    }
  }, [connection, showToast]);

  const handleRemoveReaction = useCallback(async (messageId, emoji) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) return;
    try {
      await connection.invoke('RemoveReaction', messageId, emoji);
    } catch (e) {
      console.error(e);
    }
  }, [connection]);

  // === RETRY MESSAGE ===
  const handleRetryMessage = useCallback(async (msg) => {
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      showToast('Not connected', 'error');
      return;
    }
    try {
      const att = msg.attachments?.[0];
      await connection.invoke('SendMessage', {
        ReceiverId: selectedUser?.id,
        Content: msg.content,
        Attachment: att ? {
          FileName: att.fileName || att.FileName,
          FileUrl: att.fileUrl || att.FileUrl,
          Type: att.type || att.Type,
          FileSize: att.fileSize || att.FileSize,
          MimeType: att.mimeType || att.MimeType || null
        } : null,
        ReplyToMessageId: msg.replyMessage?.id || null
      });
      // Başarılı olunca _pending flag'ini kaldır
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, _pending: false } : m
      ));
    } catch (e) {
      showToast('Retry failed', 'error');
      console.error(e);
    }
  }, [connection, selectedUser, showToast]);

  // === SEARCH MESSAGES ===
  const handleSearchMessages = useCallback(async (query) => {
    if (!token || !selectedUser) return;
    setIsSearching(true);
    try {
      const convRes = await axios.post(`${API_URL}/chat/conversation/${selectedUser.id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const convId = convRes.data.value || convRes.data.id || convRes.data;
      if (!convId) { setIsSearching(false); return; }

      const res = await axios.get(
        `${API_URL}/chat/conversations/${convId}/messages/search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const results = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setSearchResults(results.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt)));
    } catch (e) {
      setSearchResults([]);
    }
    setIsSearching(false);
  }, [token, selectedUser]);

  // === FILE SELECT WITH COMPRESSION ===
  const handleFileSelect = useCallback(async (file) => {
    if (!file) { setSelectedFile(null); return; }
    setSelectedFile(file);

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return;

    const threshold = isImage ? 1 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size <= threshold) return;

    setIsCompressing(true);
    try {
      const compressed = await compressMedia(file);
      setSelectedFile(compressed);
    } catch (err) {
      console.error('Compression failed:', err);
    }
    setIsCompressing(false);
  }, []);

  // === SEND MESSAGE FUNCTION (OPTIMIZED FOR REPLY) ===
  const sendMessage = useCallback(async (e) => {
    e.preventDefault();
    if ((!messageInput.trim() && !selectedFile) || !selectedUser || !connection) return;

    const myId = getSafeUserId(user);
    const content = messageInput.trim();

    // 1. Yanıtlanacak ID'yi sakla
    const replyToId = replyingTo ? replyingTo.id : null;

    let attachmentData = null;

    if (selectedFile) {
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
          type: selectedFile.type.startsWith('image/') ? 1
              : selectedFile.type.startsWith('video/') ? 2
              : 4,
          fileSize: res.data.fileSize
        };
        setIsUploading(false);
        setUploadProgress(0);
      } catch (error) {
        showToast('Upload failed', 'error');
        setIsUploading(false);
        return;
      }
    }

    // 2. Optimistic UI için geçici mesaj oluştur
    const clientMessageId = crypto.randomUUID();
    const tempMsg = {
      id: Date.now(),
      _clientMessageId: clientMessageId,
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

    // Y2: Mesaj gönderilince typing indicator'ı hemen temizle
    if (connection?.state === signalR.HubConnectionState.Connected) {
      connection.invoke('NotifyStoppedTyping', selectedUser.id).catch(() => {});
    }

    const messagePayload = {
      ReceiverId: selectedUser.id,
      Content: content,
      Attachment: attachmentData ? {
        FileName: attachmentData.fileName,
        FileUrl: attachmentData.fileUrl,
        Type: attachmentData.type,
        FileSize: attachmentData.fileSize,
        MimeType: attachmentData.mimeType || null
      } : null,
      ReplyToMessageId: replyToId,
      ClientMessageId: clientMessageId
    };

    // Bağlantı yoksa kuyruğa ekle
    if (!connection || connection.state !== signalR.HubConnectionState.Connected) {
      messageQueueRef.current.push(messagePayload);
      // Geçici mesajı "pending" olarak işaretle
      setMessages(prev => prev.map(m =>
        m.id === tempMsg.id ? { ...m, _pending: true } : m
      ));
      showToast('Message queued — will send when connected', 'info');
      return;
    }

    try {
      await connection.invoke('SendMessage', messagePayload);
    } catch (e) {
      // Başarısızsa kuyruğa ekle
      messageQueueRef.current.push(messagePayload);
      setMessages(prev => prev.map(m =>
        m.id === tempMsg.id ? { ...m, _pending: true } : m
      ));
      showToast('Send failed — will retry when connected', 'error');
      console.error(e);
    }
  }, [messageInput, selectedFile, selectedUser, connection, user, replyingTo, token, users, playSound, showToast]);

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
      storage.set('token', receivedToken);
      storage.set('user', JSON.stringify(userData));
      setToken(receivedToken);
      setUser(userData);
      // Refresh token'ı da sakla
      const refreshToken = responseData.refreshToken || responseData.data?.refreshToken;
      if (refreshToken) storage.set('refreshToken', refreshToken);
    }
  };

  if (!token) return <ErrorBoundary><AuthScreen onAuthSuccess={handleAuthSuccess} /></ErrorBoundary>

  const isDesktopApp = window.__TAURI__ !== undefined;

  return (
    <ErrorBoundary>
      <Suspense fallback={null}><TitleBar /></Suspense>
      <div className={`flex w-screen bg-bg-main overflow-hidden ${isDesktopApp ? 'h-[calc(100vh-32px)]' : 'h-full'}`}>
        <Toast toast={toast} />

        {isMobile && (
          <div
            className={`fixed inset-0 bg-black/60 transition-opacity duration-300 z-40 ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
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
          onToggleTheme={() => setTheme(p => p === 'dark' ? 'light' : 'dark')}
          onToggleSound={() => setSoundEnabled(p => !p)}
          onProfileClick={() => { setViewProfileUserId(null); setShowProfilePage(true) }}
          onLogout={logout}
          onSelectUser={handleSelectUser}
          onContextMenu={(e, u) => { e.preventDefault(); setViewProfileUserId(u.id); setShowProfilePage(true) }}
          isLoadingUsers={isLoadingUsers}
        />

        <div className="flex-1 relative flex flex-col h-full overflow-hidden">
          <ConnectionBanner
            connectionStatus={connectionStatus}
            isNetworkOnline={isNetworkOnline}
            onRetry={() => {
              const conn = connectionRef.current;
              if (conn && conn.state === 'Disconnected') conn.start().catch(console.error);
            }}
          />
          {showProfilePage ? (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full"></div></div>}>
              <ProfilePage
                user={viewProfileUserId ? users.find(u => String(u.id) === String(viewProfileUserId)) : user}
                userId={viewProfileUserId}
                token={token}
                API_URL={API_URL}
                currentUserId={getSafeUserId(user)}
                onClose={() => setShowProfilePage(false)}
                onLogout={logout}
                onUpdate={(updatedUser) => {
                  setUser(prev => ({ ...prev, ...updatedUser }));
                  storage.set('user', JSON.stringify({ ...user, ...updatedUser }));
                }}
                showToast={showToast}
              />
            </Suspense>
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
              setSelectedFile={handleFileSelect}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              isCompressing={isCompressing}
              currentUserId={getSafeUserId(user)}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              onEditMessage={handleEditMessage}
              onAddReaction={handleAddReaction}
              onRemoveReaction={handleRemoveReaction}
              onSearchMessages={handleSearchMessages}
              searchResults={searchResults}
              isSearching={isSearching}
              onRetryMessage={handleRetryMessage}
            />
          )}
        </div>

        {/* Call components with Suspense for lazy loading */}
        <Suspense fallback={null}>
            {callStatus === 'ringing' && String(activeCall?.initiatorId).toLowerCase() !== String(getSafeUserId(user)).toLowerCase() && (
              <IncomingCallModal call={activeCall} onAccept={acceptCall} onDecline={declineCall} />
            )}

            {callStatus === 'ringing' && String(activeCall?.initiatorId).toLowerCase() === String(getSafeUserId(user)).toLowerCase() && (
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
              connectionQuality={connectionQuality}
              onEndCall={endCall}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
            />
          )}

          {lightboxImage && <Lightbox image={lightboxImage} onClose={() => setLightboxImage(null)} />}
        </Suspense>

        {/* PWA Update Banner */}
        {pwaUpdateReady && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-3 px-4 py-3 rounded-xl bg-accent-primary text-white shadow-2xl animate-slide-up">
            <span className="text-sm font-medium">Yeni sürüm mevcut</span>
            <button
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors"
            >
              Güncelle
            </button>
          </div>
        )}

        {/* Update Modal */}
        {updateInfo?.hasUpdate && (
          <UpdateModal
            updateInfo={updateInfo}
            status={updateStatus}
            progress={updateProgress}
            errorMessage={updateError}
            onUpdate={handleUpdate}
            onClose={handleCloseUpdate}
          />
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App