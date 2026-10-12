import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
        {/* Animated custom modern loader */}
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin mb-4"></div>
        <p className="text-slate-400 font-medium">Synchronizing Secure Session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
