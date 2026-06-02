import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, LayoutDashboard, Terminal } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import NotificationsDropdown from './NotificationsDropdown';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="sticky top-0 z-40 bg-[#0F172A]/90 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2.5 group">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 transition-transform group-hover:scale-105">
          <Terminal className="w-5 h-5" />
        </div>
        <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-indigo-200 bg-clip-text text-transparent">
          LeetTogether
        </span>
      </Link>

      {/* Navigation and Interactions */}
      <div className="flex items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-slate-355 hover:text-white transition-colors"
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Real-time notifications */}
        <NotificationsDropdown />

        {/* User avatar dropdown context */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 focus:outline-none group"
          >
            <img
              src={user?.avatar || ''}
              alt={user?.username || 'User'}
              className="w-9 h-9 rounded-full border border-slate-700 hover:border-blue-500 transition-colors bg-slate-850"
            />
            <span className="text-sm font-semibold text-slate-300 group-hover:text-slate-100 transition-colors hidden sm:block">
              {user?.username || 'User'}
            </span>
          </button>

          {dropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setDropdownOpen(false)}
              ></div>
              
              <div className="absolute right-0 mt-3 w-52 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-20 py-1.5 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-700 text-xs text-slate-400 font-medium select-none">
                  Signed in as <b className="text-slate-200 block text-sm mt-0.5 truncate">{user.username}</b>
                </div>

                <Link
                  to={`/profile/${user.username}`}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  My Profile
                </Link>

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
