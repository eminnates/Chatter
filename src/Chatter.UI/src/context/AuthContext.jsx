import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { storage } from '../utils/storage';
import axios from 'axios';
import { API_URL } from '../config/constants';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storage.getSync('token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(storage.getSync('user')) } catch { return null }
  });
  
  const tokenRef = useRef(token);
  const userRef = useRef(user);

  useEffect(() => {
    tokenRef.current = token;
    userRef.current = user;
    if (token) {
      storage.set('token', token);
    } else {
      storage.remove('token');
    }
    if (user) {
      storage.set('user', JSON.stringify(user));
    } else {
      storage.remove('user');
    }
  }, [token, user]);

  const login = async (credentials) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, credentials);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (credentials) => {
    const { data } = await axios.post(`${API_URL}/api/auth/register`, credentials);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    storage.remove('token');
    storage.remove('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, tokenRef, userRef, login, register, logout, setUser, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
