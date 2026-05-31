import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, UserPlus, Mail, Check, X, Info } from 'lucide-react';
import { friendAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';

const NotificationsDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const socket = useSocket();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch initial notifications (using friend request endpoint as fallback data source, and database)
  const fetchNotifications = async () => {
    try {
      const res = await friendAPI.getFriendRequests();
      const requests = res.data.incoming.map((req) => ({
        _id: req._id,
        type: 'friend_request',
        sender: req.sender._id,
        senderUsername: req.sender.username,
        message: `${req.sender.username} sent you a friend request.`,
        createdAt: req.createdAt
      }));
      setNotifications(requests);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Set up click outside listener to close dropdown
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Listen to live socket events for real-time notifications
  useEffect(() => {
    if (!socket) return;

    socket.on('invite:received', (data) => {
      const newInvite = {
        _id: data.notification._id || Date.now().toString(),
        type: 'room_invitation',
        senderUsername: data.senderUsername,
        message: `${data.senderUsername} invited you to join room "${data.roomName}".`,
        roomId: data.roomId,
        createdAt: new Date().toISOString()
      };
      setNotifications((prev) => [newInvite, ...prev]);
    });

    socket.on('friend:request-received', (data) => {
      fetchNotifications(); // Reload list from DB
    });

    return () => {
      socket.off('invite:received');
      socket.off('friend:request-received');
    };
  }, [socket]);

  const handleFriendAction = async (requestId, action) => {
    try {
      await friendAPI.respondRequest(requestId, action === 'accept' ? 'accept' : 'reject');
      setNotifications((prev) => prev.filter((n) => n._id !== requestId));
    } catch (err) {
      console.error('Friend action failed:', err.message);
    }
  };

  const handleInvitationAction = (notification, action) => {
    if (action === 'accept') {
      setIsOpen(false);
      // Auto-join room redirect
      navigate(`/room/${notification.roomId}`);
    }
    setNotifications((prev) => prev.filter((n) => n._id !== notification._id));
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold text-white bg-blue-500 rounded-full animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl z-50 overflow-hidden transform origin-top-right transition-all">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/90 backdrop-blur">
            <h3 className="font-semibold text-slate-200">Live Notifications</h3>
            <span className="text-xs text-slate-400 font-medium">({unreadCount} pending)</span>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n._id} className="p-4 border-b border-slate-700 hover:bg-slate-750 transition-colors flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {n.type === 'friend_request' ? (
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                        <UserPlus className="w-4 h-4" />
                      </div>
                    ) : n.type === 'room_invitation' ? (
                      <div className="p-1.5 rounded-lg bg-green-500/10 text-green-400">
                        <Mail className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400">
                        <Info className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="flex-grow min-w-0">
                    <p className="text-sm text-slate-200 leading-snug break-words">{n.message}</p>
                    
                    {/* Interaction Buttons */}
                    {n.type === 'friend_request' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleFriendAction(n._id, 'accept')}
                          className="flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button
                          onClick={() => handleFriendAction(n._id, 'reject')}
                          className="flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Ignore
                        </button>
                      </div>
                    )}

                    {n.type === 'room_invitation' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => handleInvitationAction(n, 'accept')}
                          className="flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Join Room
                        </button>
                        <button
                          onClick={() => handleInvitationAction(n, 'reject')}
                          className="flex items-center justify-center gap-1 py-1 px-3 rounded-lg text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;
