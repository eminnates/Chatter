import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../config/constants';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const selectedUserRef = useRef(null);
  const usersRef = useRef([]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API_URL}/api/user/with-conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Assuming response.data returns the list of users + latest messages
      const fetchedUsers = Array.isArray(response.data) ? response.data : [];
      setUsers(fetchedUsers);
      usersRef.current = fetchedUsers;
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, [token]);

  return (
    <ChatContext.Provider value={{
      users, setUsers,
      messages, setMessages,
      selectedUser, setSelectedUser,
      isTyping, setIsTyping,
      selectedUserRef, usersRef,
      loadUsers
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
