import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import { HUB_URL } from '../config/constants';
import { useAuth } from './AuthContext';

const ConnectionContext = createContext();

export function ConnectionProvider({ children }) {
  const { token, user } = useAuth();
  const [connection, setConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const connectionRef = useRef(null);

  useEffect(() => {
    let newConnection = null;

    if (token && user && !connection) {
      newConnection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => token,
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets
        })
        .withHubProtocol(new MessagePackHubProtocol())
        .withAutomaticReconnect([0, 2000, 10000, 30000])
        .build();

      setConnection(newConnection);
      connectionRef.current = newConnection;

      newConnection.start()
        .then(() => {
          setConnectionStatus('connected');
          console.log('Connected to SignalR hub');
        })
        .catch(err => {
          console.error('SignalR connection error: ', err);
          setConnectionStatus('disconnected');
        });

      newConnection.onreconnecting(() => setConnectionStatus('reconnecting'));
      newConnection.onreconnected(() => setConnectionStatus('connected'));
      newConnection.onclose(() => setConnectionStatus('disconnected'));
    }

    return () => {
      // Cleanup logic if unmounted
      if (newConnection) {
        newConnection.stop();
      }
    };
  }, [token, user]);

  return (
    <ConnectionContext.Provider value={{ connection, connectionRef, connectionStatus }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export const useConnection = () => useContext(ConnectionContext);
