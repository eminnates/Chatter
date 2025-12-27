import { useState, useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'

const API_URL = 'http://localhost:5157/api'
const HUB_URL = 'http://localhost:5157/hubs/chat'

function App() {
  // --- Auth States ---
  const getStoredUser = () => {
    try {
      return JSON.parse(localStorage.getItem('user'));
    } catch {
      return null;
    }
  };

  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(getStoredUser())
  
  // --- Chat & UI States ---
  const [users, setUsers] = useState([]) 
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [connection, setConnection] = useState(null)

  // --- Refs ---
  const selectedUserRef = useRef(null) 
  const messagesEndRef = useRef(null)

  // --- Login & Register States ---
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [regUserName, setRegUserName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regFullName, setRegFullName] = useState('')

  // Ref Senkronizasyonu
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // --- OTOMATİK SCROLL ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // --- YARDIMCI FONKSİYON: OKUNDU BİLDİRİMİ GÖNDER ---
  const markAsRead = async (targetUserId) => {
    if (!token) return;
    try {
        await axios.post(`${API_URL}/chat/mark-read/${targetUserId}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        // UI'da listedeki bildirim sayısını sıfırla
        setUsers(prev => prev.map(u => 
            u.id === targetUserId ? { ...u, unreadCount: 0 } : u
        ));
    } catch (error) {
        console.error("Mark read error:", error);
    }
  };

  // --- 1. SignalR ve Kullanıcı Yönetimi ---
  useEffect(() => {
    let isMounted = true;
    let newConnection = null;

    if (token) {
      loadUsers(token);

      newConnection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, { 
            accessTokenFactory: () => token,
            transport: signalR.HttpTransportType.WebSockets 
        })
        .withAutomaticReconnect()
        .build();

      const startConnection = async () => {
        try {
          await newConnection.start();
          console.log("SignalR Connected.");
          if (isMounted) setConnection(newConnection);

          // -------------------------------------------------
          // A) MESAJ GELDİĞİNDE
          // -------------------------------------------------
          newConnection.on('ReceiveMessage', (message) => {
            const currentUserId = user?.id; 
            const isMyMessage = message.senderId === currentUserId;

            // 1. Eğer mesaj o an açık olan kişiden geldiyse -> ANINDA OKUNDU YAP
            if (!isMyMessage && selectedUserRef.current?.id === message.senderId) {
                markAsRead(message.senderId);
            }

            // 2. Mesajı Ekrana Ekleme
            if (isMyMessage || selectedUserRef.current?.id === message.senderId) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === message.id);
                    if (exists) return prev;
                    return [...prev, message];
                });
            }

            // 3. Kullanıcı Listesi Güncelleme
            setUsers(prevUsers => {
                const targetUserId = isMyMessage ? message.receiverId : message.senderId;
                const userIndex = prevUsers.findIndex(u => u.id === (isMyMessage ? selectedUserRef.current?.id : message.senderId));

                if (userIndex === -1) return prevUsers;

                const updatedUser = { ...prevUsers[userIndex] };
                updatedUser.lastMessageAt = new Date(); 

                // Eğer mesaj başkasından geldiyse VE o an o kişiyle konuşmuyorsak -> Sayacı Artır
                if (!isMyMessage && selectedUserRef.current?.id !== message.senderId) {
                    updatedUser.unreadCount = (updatedUser.unreadCount || 0) + 1;
                }

                const newUsers = [...prevUsers];
                newUsers.splice(userIndex, 1);
                return [updatedUser, ...newUsers];
            });
          });

          // -------------------------------------------------
          // B) KARŞI TARAF MESAJI OKUDUĞUNDA (Mavi Tik) 
          // -------------------------------------------------
          newConnection.on('MessagesRead', (conversationId) => {
             // Eğer şu an o konuşma açıksa, ekrandaki tikleri güncelle
             setMessages(prev => prev.map(msg => ({ ...msg, isRead: true })));
          });
          
          // Hata Mesajlarını Dinle
          newConnection.on('ErrorMessage', (errorMsg) => {
             console.error("Backend Error:", errorMsg);
             alert(errorMsg);
          });

        } catch (err) {
          console.error('SignalR Connection Error: ', err);
        }
      };

      startConnection();
    }

    return () => {
      isMounted = false;
      if (newConnection) {
        newConnection.off('ReceiveMessage');
        newConnection.off('MessagesRead'); // Event'i temizle
        newConnection.off('ErrorMessage');
        newConnection.stop();
      }
    };
  }, [token]);

  // --- 2. Kullanıcı Seçimi ---
  const handleSelectUser = async (u) => {
    setSelectedUser(u);
    // Seçince okundu olarak işaretle
    markAsRead(u.id); 
  };

  useEffect(() => {
    if (selectedUser && token) {
      loadMessages(selectedUser.id);
    }
  }, [selectedUser]);

  // --- API Fonksiyonları ---
  const loadUsers = async (activeToken) => {
    try {
      const response = await axios.get(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const userList = Array.isArray(response.data) ? response.data : (response.data.data || []);
      setUsers(userList); 
    } catch (error) {
      console.error('Users load error:', error);
      if(error.response?.status === 401) logout();
    }
  };

  const loadMessages = async (userId) => {
    try {
      const convResponse = await axios.post(`${API_URL}/chat/conversation/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      let conversationId = convResponse.data; 
      if(typeof conversationId === 'object' && conversationId.value) conversationId = conversationId.value;
      if(typeof conversationId === 'object' && conversationId.id) conversationId = conversationId.id;

      if(!conversationId) throw new Error("Conversation ID not found");

      const msgResponse = await axios.get(`${API_URL}/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const messageList = Array.isArray(msgResponse.data) ? msgResponse.data : (msgResponse.data.data || []);

      const sortedMessages = messageList.sort((a, b) => 
        new Date(a.sentAt) - new Date(b.sentAt)
      );

      setMessages(sortedMessages);
    } catch (error) {
      console.error("Load messages error:", error);
      setMessages([]);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser || !connection) return;

    const content = messageInput;
    const receiverId = selectedUser.id;
    const currentUserId = user?.id;

    try {
      await connection.invoke('SendMessage', { 
          receiverId: receiverId, 
          content: content 
      });

      // Optimistic UI Update (Anında Ekrana Düşsün)
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        content: content,
        senderId: currentUserId,
        receiverId: receiverId,
        sentAt: new Date().toISOString(),
        isRead: false // Başta okunmadı olarak eklenir
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setMessageInput('');

      setUsers(prev => {
          const userIndex = prev.findIndex(u => u.id === receiverId);
          if (userIndex === -1) return prev;
          
          const updatedUser = { ...prev[userIndex], lastMessageAt: new Date() };
          const newUsers = [...prev];
          newUsers.splice(userIndex, 1);
          return [updatedUser, ...newUsers];
      });

    } catch (err) {
      console.error('Send failed: ', err);
      alert("Mesaj gönderilemedi. Bağlantıyı kontrol edin.");
    }
  };

  // --- Auth Helper ---
  const handleAuthSuccess = (responseData) => {
    const token = responseData.token || responseData.data?.token;
    
    if (!token) {
        alert("Login successful but no token received.");
        return;
    }

    const userData = {
        id: responseData.id || responseData.data?.id,
        userName: responseData.userName || responseData.data?.userName,
        fullName: responseData.fullName || responseData.data?.fullName,
        email: responseData.email || responseData.data?.email
    };

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(token);
    setUser(userData);
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      handleAuthSuccess(response.data); 
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.message || "Check console"));
    }
  };

  const register = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        userName: regUserName,
        email: regEmail,
        password: regPassword,
        fullName: regFullName
      });
      handleAuthSuccess(response.data);
    } catch (error) {
      alert('Register failed: ' + (error.response?.data?.message || "Check console"));
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setMessages([]);
    setSelectedUser(null);
    if (connection) connection.stop();
  };

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>{isRegistering ? 'Create Account' : 'Welcome Back'}</h2>
          <form onSubmit={isRegistering ? register : login}>
            {isRegistering && (
              <>
                <input type="text" placeholder="Username" value={regUserName} onChange={e => setRegUserName(e.target.value)} required />
                <input type="text" placeholder="Full Name" value={regFullName} onChange={e => setRegFullName(e.target.value)} />
              </>
            )}
            <input type="email" placeholder="Email" value={isRegistering ? regEmail : email} onChange={e => isRegistering ? setRegEmail(e.target.value) : setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={isRegistering ? regPassword : password} onChange={e => isRegistering ? setRegPassword(e.target.value) : setPassword(e.target.value)} required />
            <button type="submit">{isRegistering ? 'Sign Up' : 'Sign In'}</button>
            <p onClick={() => setIsRegistering(!isRegistering)} style={{textAlign:'center', marginTop: 15, color: '#6366f1', cursor:'pointer'}}>
              {isRegistering ? 'Already have an account? Login' : "Don't have an account? Register"}
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>Chatter</h3>
          <div className="user-profile-summary">
              <small>{user?.fullName || user?.userName}</small>
          </div>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
        <div className="user-list">
          {users.length === 0 && <p style={{padding: 20, color: '#666'}}>No users found.</p>}
          {users.filter(u => u.id !== user?.id).map(u => (
            <div 
              key={u.id} 
              className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
              onClick={() => handleSelectUser(u)}
            >
              <div className="user-avatar">
                {u.fullName?.[0]?.toUpperCase() || u.userName?.[0]?.toUpperCase()}
              </div>
              <div className="user-row">
                  <div className="user-info">
                    <span className="user-name">{u.fullName || u.userName}</span>
                    {u.isOnline && <span className="online-dot" title="Online"></span>}
                  </div>
                  {u.unreadCount > 0 && (
                      <div className="notification-badge">{u.unreadCount}</div>
                  )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h3>{selectedUser.fullName || selectedUser.userName}</h3>
              {selectedUser.isOnline && <span style={{color: '#10b981', fontSize: '0.8rem', marginLeft: 10}}>● Online</span>}
            </div>
            
            <div className="messages">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`message ${msg.senderId === user?.id ? 'sent' : 'received'}`}
                >
                  <div className="msg-bubble">{msg.content}</div>
                  <div className="msg-time">
                      {new Date(msg.sentAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      {/* --- OKUNDU TİKLERİ --- */}
                      {msg.senderId === user?.id && (
                          <span style={{marginLeft: 5, fontSize: '0.8rem', color: msg.isRead ? '#4ade80' : '#ccc'}}>
                            {msg.isRead ? ' ✓✓' : ' ✓'}
                          </span>
                      )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form className="input-area" onSubmit={sendMessage}>
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