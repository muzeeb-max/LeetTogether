/**
 * VoicePanel.jsx
 *
 * Presentational voice chat UI component.
 * Renders into the right sidebar of RoomView between the participants list
 * and the workspace chat panel.
 *
 * Receives all state from the useVoiceChat hook via props — contains
 * zero WebRTC or socket logic itself.
 */

import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

/**
 * @param {{
 *   isMuted: boolean,
 *   toggleMute: () => void,
 *   voiceUsers: Array<{ socketId: string, userId: string, username: string, isSpeaking: boolean, isLocal?: boolean }>,
 *   isConnected: boolean,
 *   permissionDenied: boolean,
 *   currentUserId: string
 * }} props
 */
const VoicePanel = ({ isMuted, toggleMute, voiceUsers, isConnected, permissionDenied, currentUserId }) => {

  // ─────────────────────────────────────────────────────────────────────────
  // Sub-component: individual voice user row
  // ─────────────────────────────────────────────────────────────────────────
  const VoiceUserRow = ({ user }) => {
    const isMe = user.userId === currentUserId?.toString();
    return (
      <div className="flex items-center gap-2 py-1 px-1 rounded-lg transition-colors">
        {/* Speaking indicator ring */}
        <div className="relative flex-shrink-0">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] uppercase
              ${user.isSpeaking
                ? 'bg-emerald-500/20 text-emerald-300 ring-2 ring-emerald-500 ring-offset-1 ring-offset-slate-900'
                : 'bg-slate-700/60 text-slate-400'
              } transition-all duration-150`}
          >
            {user.username?.charAt(0)}
          </div>
          {/* Animated pulse when speaking */}
          {user.isSpeaking && (
            <span className="absolute inset-0 rounded-full ring-2 ring-emerald-500 animate-ping opacity-40" />
          )}
        </div>

        {/* Username */}
        <span className={`text-xs font-semibold truncate flex-grow
          ${user.isSpeaking ? 'text-emerald-300' : 'text-slate-300'}`}
        >
          {user.username}{isMe ? ' (you)' : ''}
        </span>

        {/* Speaking label */}
        {user.isSpeaking && (
          <span className="text-[9px] text-emerald-400 font-bold tracking-wide flex-shrink-0">
            speaking
          </span>
        )}

        {/* Muted indicator for self */}
        {isMe && isMuted && (
          <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Mic permission denied state
  // ─────────────────────────────────────────────────────────────────────────
  if (permissionDenied) {
    return (
      <div className="p-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <Volume2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            Voice Chat
          </span>
        </div>
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-300 leading-relaxed">
            Mic access denied. Allow microphone permission in your browser to use voice chat.
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Connecting state
  // ─────────────────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="p-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <Volume2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
            Voice Chat
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-3 h-3 rounded-full border border-slate-500 border-t-transparent animate-spin" />
          <span className="text-[10px]">Connecting to voice...</span>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Connected state — full panel
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-3 border-b border-slate-800 flex-shrink-0">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
            Voice Chat
          </span>
          {/* Connected dot */}
          <span className="flex items-center gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-emerald-500 font-semibold">live</span>
          </span>
        </div>

        {/* Mute / Unmute button */}
        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex items-center gap-1 py-1 px-2 rounded-lg text-[10px] font-bold transition-all duration-200 cursor-pointer
            ${isMuted
              ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25'
              : 'bg-slate-700/60 text-slate-300 border border-slate-600/40 hover:bg-slate-700 hover:text-white'
            }`}
        >
          {isMuted
            ? <><MicOff className="w-3 h-3" /> Unmute</>
            : <><Mic  className="w-3 h-3" /> Mute</>
          }
        </button>
      </div>

      {/* Voice user list */}
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {voiceUsers.length === 0 ? (
          <p className="text-[10px] text-slate-600 italic pl-1">No one else in voice yet...</p>
        ) : (
          voiceUsers.map((u) => (
            <VoiceUserRow key={u.socketId} user={u} />
          ))
        )}
      </div>

      {/* Muted state banner */}
      {isMuted && (
        <div className="mt-2 flex items-center gap-1.5 bg-red-500/8 border border-red-500/20 rounded-lg px-2 py-1">
          <MicOff className="w-3 h-3 text-red-400 flex-shrink-0" />
          <span className="text-[10px] text-red-400 font-semibold">
            Your microphone is muted
          </span>
        </div>
      )}
    </div>
  );
};

export default VoicePanel;
