import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

const VoicePanel = ({ isMuted, toggleMute, voiceUsers, isConnected, permissionDenied, currentUserId }) => {

  const VoiceUserRow = ({ user }) => {
    const isMe = user.userId === currentUserId?.toString();
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-[#3E3E42]/50 transition-colors">
        <div className="relative flex-shrink-0">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] uppercase
              ${user.isSpeaking
                ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500 ring-offset-1 ring-offset-[#282828]'
                : 'bg-[#1E1E1E] text-slate-400 border border-[#3E3E42]'
              } transition-all duration-150`}
          >
            {user.username?.charAt(0)}
          </div>
          {user.isSpeaking && (
            <span className="absolute inset-0 rounded-full ring-2 ring-emerald-500 animate-ping opacity-40" />
          )}
        </div>

        <span className={`text-[11px] font-medium truncate flex-grow
          ${user.isSpeaking ? 'text-emerald-400' : 'text-slate-300'}`}
        >
          {user.username}{isMe ? ' (you)' : ''}
        </span>

        {user.isSpeaking && (
          <span className="text-[9px] text-emerald-500 font-bold tracking-wide flex-shrink-0">
            speaking
          </span>
        )}

        {isMe && isMuted && (
          <MicOff className="w-3 h-3 text-red-500 flex-shrink-0" />
        )}
      </div>
    );
  };

  if (permissionDenied) {
    return (
      <div className="p-3 border-b border-[#3E3E42] bg-[#282828] flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2 text-slate-400">
          <Volume2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Voice Chat</span>
        </div>
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-md p-2">
          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-400 leading-relaxed">
            Mic access denied. Please allow microphone permissions.
          </p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="p-3 border-b border-[#3E3E42] bg-[#282828] flex-shrink-0">
        <div className="flex items-center gap-1.5 mb-2 text-slate-400">
          <Volume2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Voice Chat</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          <span className="text-[10px] font-medium">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-[#3E3E42] bg-[#282828] flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-semibold text-slate-300">
            Voice Chat
          </span>
          <span className="flex items-center gap-1 ml-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Live</span>
          </span>
        </div>

        <button
          onClick={toggleMute}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md text-[10px] font-semibold transition-all duration-200 cursor-pointer
            ${isMuted
              ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
              : 'bg-[#3E3E42] text-slate-300 hover:bg-[#4E4E52]'
            }`}
        >
          {isMuted
            ? <><MicOff className="w-3 h-3" /> Unmute</>
            : <><Mic  className="w-3 h-3" /> Mute</>
          }
        </button>
      </div>

      <div className="space-y-0.5 max-h-32 overflow-y-auto custom-scrollbar">
        {voiceUsers.length === 0 ? (
          <p className="text-[10px] text-slate-500 italic pl-1">No one else in voice yet...</p>
        ) : (
          voiceUsers.map((u) => (
            <VoiceUserRow key={u.socketId} user={u} />
          ))
        )}
      </div>

      {isMuted && (
        <div className="mt-2 flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-md px-2.5 py-1.5">
          <MicOff className="w-3 h-3 text-red-500 flex-shrink-0" />
          <span className="text-[10px] text-red-500 font-medium">
            Your mic is muted
          </span>
        </div>
      )}
    </div>
  );
};

export default VoicePanel;
