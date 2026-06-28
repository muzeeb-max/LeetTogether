import React, { createContext, useEffect, useState, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    let activeSocket = null;

    if (user) {
      const token = localStorage.getItem('token');
      console.log('[SOCKET-CTX] Creating new socket connection for user:', user.id, user.username);
      
      // Instantiate socket client pointing to backend server
      activeSocket = io(
        import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
        {
          auth: { token },
          transports: ['websocket'],
          reconnectionAttempts: 5,
          reconnectionDelay: 2000
        }
      );

      activeSocket.on('connect', () => {
        console.log('[SOCKET-CTX] Connected - Socket ID:', activeSocket.id, 'User:', user.id);
      });

      activeSocket.on('disconnect', (reason) => {
        console.log('[SOCKET-CTX] Disconnected - Reason:', reason, 'Socket ID:', activeSocket?.id);
      });

      activeSocket.on('reconnect', (attemptNumber) => {
        console.log('[SOCKET-CTX] Reconnected after attempt:', attemptNumber);
      });

      activeSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log('[SOCKET-CTX] Reconnect attempt:', attemptNumber);
      });

      activeSocket.on('connect_error', (err) => {
        console.error('[SOCKET-CTX] Connection Error:', err.message);
      });

      setSocket(activeSocket);
    } else {
      console.log('[SOCKET-CTX] User is null, disconnecting existing socket');
      if (socket) {
        console.log('[SOCKET-CTX] Disconnecting socket:', socket.id);
        socket.disconnect();
        setSocket(null);
      }
    }

    // Cleanup on unmount or user change
    return () => {
      if (activeSocket) {
        console.log('[SOCKET-CTX] Cleanup - Disconnecting socket:', activeSocket.id);
        activeSocket.disconnect();
      }
    };
  }, [user?.id]); // Only recreate socket when user ID changes, not when user object reference changes

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
