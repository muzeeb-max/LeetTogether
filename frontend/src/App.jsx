import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const RoomView = lazy(() => import('./pages/RoomView'));
const SpotifyCallback = lazy(() => import('./pages/SpotifyCallback'));

const LoadingScreen = () => (
  <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 text-zinc-400" role="status" aria-live="polite">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
    <span className="text-sm">Preparing your workspace…</span>
  </div>
);

// Pages Import







function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="min-h-screen bg-[#09090B] text-zinc-100 selection:bg-violet-500/30">
            <div className="route-enter"><Suspense fallback={<LoadingScreen />}><Routes>
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
            </Routes></Suspense></div>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
