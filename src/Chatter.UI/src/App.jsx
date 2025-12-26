import { useState, useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import axios from 'axios'
import './index.css'

const API_URL = 'http://localhost:5157/api'
const HUB_URL = 'http://localhost:5157/hubs/chat'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')))
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [messageInput, setMessageInput] = useState('')
  const [connection, setConnection] = useState(null)
  
  // Login State
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register State
  const [isRegistering, setIsRegistering] = useState(false)
  const [regUserName, setRegUserName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regFullName, setRegFullName] = useState('')

  useEffect(() => {
    if (token) {
      initializeConnection()
      loadUsers()
    }
  }, [token])

  useEffect(() => {
    if (selectedUser && connection) {
      loadMessages(selectedUser.id)
    }
  }, [selectedUser])

  const initializeConnection = async () => {
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build()

    newConnection.on('ReceiveMessage', (message) => {
      setMessages(prev => [...prev, message])
    })

    try {
      await newConnection.start()
      setConnection(newConnection)
    } catch (err) {
      console.error('Connection failed: ', err)
    }
  }

  const login = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password })
      const { token, ...userData } = response.data.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setToken(token)
      setUser(userData)
    } catch (error) {
      console.error('Login error:', error)
      alert('Login failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const register = async (e) => {
    e.preventDefault()
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        userName: regUserName,
        email: regEmail,
        password: regPassword,
        fullName: regFullName
      })
      const { token, ...userData } = response.data.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setToken(token)
      setUser(userData)
    } catch (error) {
      console.error('Register error:', error)
      alert('Register failed: ' + (error.response?.data?.message || error.message))
    }
  }

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(response.data.data)
    } catch (error) {
      console.error('Failed to load users')
    }
  }

  const loadMessages = async (userId) => {
    try {
      // 1. Get or create conversation ID
      const convResponse = await axios.post(`${API_URL}/chat/conversation/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const conversationId = convResponse.data.data.conversationId

      // 2. Get messages
      const msgResponse = await axios.get(`${API_URL}/chat/messages/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // 3. Format messages for UI
      // We don't need to transform senderId to 'me' anymore, we'll handle it in render
      setMessages(msgResponse.data.data.reverse()) 
    } catch (error) {
      console.error('Failed to load messages', error)
      setMessages([])
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!messageInput.trim() || !selectedUser || !connection) return

    try {
      await connection.invoke('SendMessage', {
        receiverId: selectedUser.id,
        content: messageInput
      })
      // Optimistically add message
      setMessages(prev => [...prev, {
        content: messageInput,
        senderId: user.userId, 
        sentAt: new Date()
      }])
      setMessageInput('')
    } catch (err) {
      console.error('Send failed: ', err)
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    setMessages([])
    setSelectedUser(null)
    if (connection) {
      connection.stop()
    }
  }

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>{isRegistering ? 'Register' : 'Login'}</h2>
          {isRegistering ? (
            <form onSubmit={register}>
              <div style={{marginBottom: 10}}>
                <input 
                  type="text" 
                  placeholder="Username" 
                  value={regUserName} 
                  onChange={e => setRegUserName(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box'}}
                  required
                />
              </div>
              <div style={{marginBottom: 10}}>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={regEmail} 
                  onChange={e => setRegEmail(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box'}}
                  required
                />
              </div>
              <div style={{marginBottom: 10}}>
                <input 
                  type="text" 
                  placeholder="Full Name" 
                  value={regFullName} 
                  onChange={e => setRegFullName(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box'}}
                />
              </div>
              <div style={{marginBottom: 10}}>
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={regPassword} 
                  onChange={e => setRegPassword(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box'}}
                  required
                />
              </div>
              <button type="submit" style={{width: '100%', marginBottom: 10}}>Register</button>
              <div style={{textAlign: 'center'}}>
                <span 
                  style={{color: '#007bff', cursor: 'pointer'}} 
                  onClick={() => setIsRegistering(false)}
                >
                  Already have an account? Login
                </span>
              </div>
            </form>
          ) : (
            <form onSubmit={login}>
              <div style={{marginBottom: 10}}>
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box'}}
                  required
                />
              </div>
              <div style={{marginBottom: 10}}>
                <input 
                  type="password" 
                  placeholder="Password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  style={{width: '100%', boxSizing: 'border-box'}}
                  required
                />
              </div>
              <button type="submit" style={{width: '100%', marginBottom: 10}}>Login</button>
              <div style={{textAlign: 'center'}}>
                <span 
                  style={{color: '#007bff', cursor: 'pointer'}} 
                  onClick={() => setIsRegistering(true)}
                >
                  Don't have an account? Register
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="sidebar">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
          <h3 style={{margin: 0}}>Users</h3>
          <button onClick={logout} style={{padding: '5px 10px', fontSize: '12px', background: '#dc3545'}}>Logout</button>
        </div>
        {users.map(u => (
          <div 
            key={u.id} 
            className="user-item"
            onClick={() => setSelectedUser(u)}
            style={{background: selectedUser?.id === u.id ? '#e3f2fd' : 'transparent'}}
          >
            {u.fullName || u.userName}
          </div>
        ))}
      </div>
      
      <div className="chat-area">
        {selectedUser ? (
          <>
            <div style={{padding: 20, borderBottom: '1px solid #ddd'}}>
              <h3>Chat with {selectedUser.fullName || selectedUser.userName}</h3>
            </div>
            
            <div className="messages">
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.senderId === user?.userId ? 'sent' : ''}`}>
                  {msg.content}
                </div>
              ))}
            </div>

            <form className="input-area" onSubmit={sendMessage}>
              <input 
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                placeholder="Type a message..."
              />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <div style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            Select a user to start chatting
          </div>
        )}
      </div>
    </div>
  )
}

export default App
