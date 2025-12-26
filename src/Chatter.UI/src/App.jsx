import { useState, useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'

const API_URL = 'http://localhost:5157/api'
const HUB_URL = 'http://localhost:5157/hubs/chat'

function App() {
  // --- Auth States ---
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')))
  
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
  // Mesajlar her güncellendiğinde en alta kaydır
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
          if (isMounted) setConnection(newConnection);

          newConnection.on('ReceiveMessage', (message) => {
            const currentUserId = user?.userId || user?.id;
            const isMyMessage = message.senderId === currentUserId;

            // A) Mesajı Ekrana Ekleme (Eğer o kişiyle konuşuyorsak veya ben attıysam)
            if (isMyMessage || selectedUserRef.current?.id === message.senderId) {
                setMessages(prev => {
                    const exists = prev.some(m => m.id === message.id && message.id !== undefined);
                    if (exists) return prev;
                    // Yeni mesajı listenin SONUNA ekle (Append)
                    return [...prev, message];
                });
            }

            // B) Kullanıcı Listesi Güncelleme (Sıralama + Bildirim)
            setUsers(prevUsers => {
                const targetUserId = isMyMessage ? message.receiverId : message.senderId;
                const userIndex = prevUsers.findIndex(u => u.id === targetUserId);

                if (userIndex === -1) return prevUsers;

                const updatedUser = { ...prevUsers[userIndex] };
                updatedUser.lastMessageAt = new Date(); 

                if (!isMyMessage && selectedUserRef.current?.id !== message.senderId) {
                    updatedUser.unreadCount = (updatedUser.unreadCount || 0) + 1;
                }

                const newUsers = [...prevUsers];
                newUsers.splice(userIndex, 1);
                return [updatedUser, ...newUsers];
            });
          });

        } catch (err) {
          console.error('SignalR Error: ', err);
        }
      };

      startConnection();
    }

    return () => {
      isMounted = false;
      if (newConnection) {
        newConnection.off('ReceiveMessage');
        newConnection.stop();
      }
    };
  }, [token, user?.userId, user?.id]);

  // --- 2. Kullanıcı Seçimi ---
  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setUsers(prev => prev.map(user => 
        user.id === u.id ? { ...user, unreadCount: 0 } : user
    ));
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
      const initializedUsers = response.data.data.map(u => ({
          ...u,
          unreadCount: 0,
          lastMessageAt: null 
      }));
      setUsers(initializedUsers);
    } catch (error) {
      console.error('Users load error:', error);
    }
  };

  // --- KRİTİK BÖLÜM: MESAJ YÜKLEME ---
  const loadMessages = async (userId) => {
    try {
      const convResponse = await axios.post(`${API_URL}/chat/conversation/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const conversationId = convResponse.data.data.conversationId;
      const msgResponse = await axios.get(`${API_URL}/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // --- DÜZELTME BURADA ---
      // Gelen mesajları tarihe göre (Eskiden -> Yeniye) sıralıyoruz.
      // a.sentAt - b.sentAt = Küçük tarih (Eski) önce gelir.
      const sortedMessages = msgResponse.data.data.sort((a, b) => 
        new Date(a.sentAt) - new Date(b.sentAt)
      );

      setMessages(sortedMessages);
    } catch (error) {
      setMessages([]);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser || !connection) return;

    const content = messageInput;
    const receiverId = selectedUser.id;

    try {
      await connection.invoke('SendMessage', { receiverId, content });

      const currentUserId = user?.userId || user?.id;
      // Yeni mesajı dizinin sonuna ekliyoruz (En alta)
      setMessages(prev => [...prev, {
        content: content,
        senderId: currentUserId, 
        sentAt: new Date().toISOString()
      }]);
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
    }
  };

  const handleAuthSuccess = (data) => {
    const { token: receivedToken, ...userData } = data;
    localStorage.setItem('token', receivedToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(receivedToken);
    setUser(userData);
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      handleAuthSuccess(response.data.data);
    } catch (error) {
      alert('Login failed');
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
      handleAuthSuccess(response.data.data);
    } catch (error) {
      alert('Register failed');
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
          <h3>Chats</h3>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
        <div className="user-list">
          {users.filter(u => u.id !== (user?.userId || user?.id)).map(u => (
            <div 
              key={u.id} 
              className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
              onClick={() => handleSelectUser(u)}
            >
              <div className="user-avatar">
                {u.fullName?.[0] || u.userName?.[0]}
              </div>
              <div className="user-row">
                  <div className="user-info">
                    <span className="user-name">{u.fullName || u.userName}</span>
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
            </div>
            
            <div className="messages">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`message ${msg.senderId === (user?.userId || user?.id) ? 'sent' : 'received'}`}
                >
                  <div className="msg-bubble">{msg.content}</div>
                </div>
              ))}
              {/* Bu div sayesinde her zaman en alta scroll olur */}
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
              <div className="chat-icon-wrapper">
                <svg viewBox="0 0 24 24" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
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