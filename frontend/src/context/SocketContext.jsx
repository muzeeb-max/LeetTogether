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
        console.log('Real-Time WebSockets tunnel established.');
      });

      activeSocket.on('connect_error', (err) => {
        console.error('Socket Connection Error:', err.message);
      });

      setSocket(activeSocket);
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }

    // Cleanup on unmount or user change
    return () => {
      if (activeSocket) {
        activeSocket.disconnect();
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
