import React from 'react';
import { AuthProvider } from './AuthContext';
import { ChatProvider } from './ChatContext';
import { ConnectionProvider } from './ConnectionContext';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ChatProvider>
        <ConnectionProvider>
          {children}
        </ConnectionProvider>
      </ChatProvider>
    </AuthProvider>
  );
}
