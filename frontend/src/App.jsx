import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages Import
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import RoomView from './pages/RoomView';
import SpotifyCallback from './pages/SpotifyCallback';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="bg-[#0F172A] min-h-screen text-slate-100 selection:bg-blue-500/30">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/spotify-callback" element={<SpotifyCallback />} />

              {/* Protected Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile/:username"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/room/:roomId"
                element={
                  <ProtectedRoute>
                    <RoomView />
                  </ProtectedRoute>
                }
              />

              {/* Redirect Unknown Routes to Dashboard */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
