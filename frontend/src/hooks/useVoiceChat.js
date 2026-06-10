/**
 * useVoiceChat.js
 *
 * Completely self-contained custom React hook for WebRTC peer-to-peer audio.
 *
 * Provides:
 *  - isMuted / toggleMute
 *  - voiceUsers: [{ socketId, userId, username, isSpeaking }]
 *  - isConnected: mic acquired and joined voice
 *  - permissionDenied: true if getUserMedia was denied
 *
 * This hook owns the entire WebRTC lifecycle:
 *  - getUserMedia → voice:join → receive peers → create offers/answers → ICE negotiation
 *  - cleanup: closes all RTCPeerConnections, stops MediaStream, removes audio elements
 *
 * It has NO knowledge of room state, chat, editor, or any other feature.
 * All socket events it touches are exclusively prefixed "voice:".
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Public STUN servers only — no TURN, no credentials needed
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const SPEAKING_THRESHOLD = 12;       // RMS amplitude threshold for speaking detection
const SPEAKING_POLL_MS   = 100;      // How often to sample the analyser node

/**
 * @param {{ socket: object|null, roomId: string, user: object|null }} params
 */
export function useVoiceChat({ socket, roomId, user }) {
  const [isMuted,          setIsMuted]          = useState(false);
  const [isConnected,      setIsConnected]       = useState(false);
  const [permissionDenied, setPermissionDenied]  = useState(false);
  const [voiceUsers,       setVoiceUsers]        = useState([]);

  // Refs so callbacks always read current values without causing re-renders
  const localStreamRef     = useRef(null);   // MediaStream from getUserMedia
  const peerConnectionsRef = useRef(new Map()); // socketId → RTCPeerConnection
  const audioElementsRef   = useRef(new Map()); // socketId → <audio> element
  const audioContextRef    = useRef(null);   // AudioContext for speaking detection
  const speakingTimerRef   = useRef(null);   // setInterval id for speaking poll
  const localAnalyserRef   = useRef(null);   // AnalyserNode for local mic
  const isMutedRef         = useRef(false);  // muted state accessible in closures
  const isJoinedRef        = useRef(false);  // guard: prevents emitting voice:join twice

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Create an RTCPeerConnection with all required config. Returns the pc. */
  const createPeerConnection = useCallback((targetSocketId) => {
    // Guard: reuse existing connection for same target
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return peerConnectionsRef.current.get(targetSocketId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local audio tracks so the remote end hears us
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidate ready → relay via socket
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('voice:ice-candidate', { to: targetSocketId, candidate });
      }
    };

    // Remote track received → attach to hidden <audio> element
    pc.ontrack = ({ streams }) => {
      const remoteStream = streams[0];
      if (!remoteStream) return;

      // Remove any stale audio element for this peer before creating a new one
      removeAudioElement(targetSocketId);

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.srcObject = remoteStream;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioElementsRef.current.set(targetSocketId, audio);

      // Set up speaking detection for this remote stream
      setupRemoteSpeakingDetection(targetSocketId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed' ||
        pc.connectionState === 'disconnected'
      ) {
        closePeerConnection(targetSocketId);
      }
    };

    peerConnectionsRef.current.set(targetSocketId, pc);
    return pc;
  }, [socket]);

  /** Close and remove a single RTCPeerConnection. */
  const closePeerConnection = useCallback((targetSocketId) => {
    const pc = peerConnectionsRef.current.get(targetSocketId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peerConnectionsRef.current.delete(targetSocketId);
    }
    removeAudioElement(targetSocketId);

    // Remove from voiceUsers list
    setVoiceUsers((prev) => prev.filter((u) => u.socketId !== targetSocketId));
  }, []);

  /** Remove a hidden <audio> element from the DOM. */
  const removeAudioElement = (targetSocketId) => {
    const el = audioElementsRef.current.get(targetSocketId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioElementsRef.current.delete(targetSocketId);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Speaking Detection
  // ─────────────────────────────────────────────────────────────────────────

  /** Set up Web Audio analyser for local mic — updates local user's isSpeaking. */
  const setupLocalSpeakingDetection = (stream) => {
    try {
      const ctx      = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = ctx;
      localAnalyserRef.current = analyser;
    } catch (_) {
      // Speaking detection is best-effort — silently ignore
    }
  };

  /** Set up speaking detection for a remote peer's stream. */
  const setupRemoteSpeakingDetection = (targetSocketId, remoteStream) => {
    try {
      const ctx      = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(remoteStream);
      source.connect(analyser);

      // Store analyser on peerConnection so we can query it in the poll loop
      const pc = peerConnectionsRef.current.get(targetSocketId);
      if (pc) pc._analyser = analyser;
    } catch (_) {}
  };

  /** Poll all analysers and update isSpeaking flags on voiceUsers. */
  const startSpeakingPoll = () => {
    if (speakingTimerRef.current) return; // already running
    speakingTimerRef.current = setInterval(() => {
      const buf = new Uint8Array(512);

      // Local speaking
      if (localAnalyserRef.current && !isMutedRef.current) {
        localAnalyserRef.current.getByteFrequencyData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
        const isSpeaking = rms > SPEAKING_THRESHOLD;
        setVoiceUsers((prev) =>
          prev.map((u) =>
            u.userId === user?.id?.toString()
              ? { ...u, isSpeaking }
              : u
          )
        );
      }

      // Remote peers' speaking
      peerConnectionsRef.current.forEach((pc, sid) => {
        if (pc._analyser) {
          pc._analyser.getByteFrequencyData(buf);
          const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
          const isSpeaking = rms > SPEAKING_THRESHOLD;
          setVoiceUsers((prev) =>
            prev.map((u) =>
              u.socketId === sid ? { ...u, isSpeaking } : u
            )
          );
        }
      });
    }, SPEAKING_POLL_MS);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup — called on unmount or when socket/roomId change
  // ─────────────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // 1. Stop speaking detection poll
    if (speakingTimerRef.current) {
      clearInterval(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }

    // 2. Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // 3. Close all peer connections (which also removes audio elements)
    peerConnectionsRef.current.forEach((_, sid) => closePeerConnection(sid));
    peerConnectionsRef.current.clear();

    // 4. Remove any remaining audio elements
    audioElementsRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    audioElementsRef.current.clear();

    // 5. Stop local MediaStream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    // 6. Tell server we left voice
    if (socket && isJoinedRef.current) {
      socket.emit('voice:leave');
    }
    isJoinedRef.current = false;

    // 7. Remove all voice:* socket listeners
    if (socket) {
      socket.off('voice:room-users');
      socket.off('voice:user-joined');
      socket.off('voice:user-left');
      socket.off('voice:offer');
      socket.off('voice:answer');
      socket.off('voice:ice-candidate');
    }

    setIsConnected(false);
    setVoiceUsers([]);
  }, [socket, closePeerConnection]);

  // ─────────────────────────────────────────────────────────────────────────
  // Main Effect — mount when socket + roomId + user are all ready
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !roomId || !user) return;

    let cancelled = false; // prevent async races after unmount

    const init = async () => {
      // ── Acquire microphone ──────────────────────────────────────────────
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err) {
        if (!cancelled) {
          console.warn('[Voice] Mic permission denied:', err.message);
          setPermissionDenied(true);
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      localStreamRef.current = stream;
      setupLocalSpeakingDetection(stream);

      // ── Add self to voiceUsers list ─────────────────────────────────────
      setVoiceUsers([{
        socketId: socket.id,
        userId:   user.id.toString(),
        username: user.username,
        isSpeaking: false,
        isLocal: true,
      }]);

      // ── Register socket listeners BEFORE emitting voice:join ────────────

      /**
       * voice:room-users — server sends us existing voice peers.
       * We are the offerer: create a connection for each and send an offer.
       */
      socket.on('voice:room-users', async ({ users }) => {
        if (cancelled) return;
        setVoiceUsers((prev) => {
          const newUsers = users.filter((u) => !prev.some((p) => p.socketId === u.socketId));
          return [...prev, ...newUsers.map((u) => ({ ...u, isSpeaking: false }))];
        });

        for (const peer of users) {
          if (peer.socketId === socket.id) continue;
          try {
            const pc  = createPeerConnection(peer.socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice:offer', { to: peer.socketId, sdp: offer });
          } catch (err) {
            console.error('[Voice] Error creating offer:', err);
          }
        }
      });

      /**
       * voice:user-joined — a new user joined after us.
       * They are the offerer, but we add them to our list now.
       * The actual connection is established when we receive their voice:offer.
       */
      socket.on('voice:user-joined', (peer) => {
        if (cancelled) return;
        setVoiceUsers((prev) => {
          if (prev.some((u) => u.socketId === peer.socketId)) return prev;
          return [...prev, { ...peer, isSpeaking: false }];
        });
      });

      /**
       * voice:user-left — a peer disconnected or left voice.
       * Close their RTCPeerConnection and remove their audio element.
       */
      socket.on('voice:user-left', ({ socketId }) => {
        if (cancelled) return;
        closePeerConnection(socketId);
      });

      /**
       * voice:offer — a peer sent us an SDP offer.
       * We are the answerer: set remote desc, create answer, send back.
       */
      socket.on('voice:offer', async ({ from, sdp }) => {
        if (cancelled) return;
        try {
          const pc = createPeerConnection(from);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice:answer', { to: from, sdp: answer });
        } catch (err) {
          console.error('[Voice] Error handling offer:', err);
        }
      });

      /**
       * voice:answer — the peer we sent an offer to has answered.
       * Set their remote description so ICE negotiation can complete.
       */
      socket.on('voice:answer', async ({ from, sdp }) => {
        if (cancelled) return;
        try {
          const pc = peerConnectionsRef.current.get(from);
          if (pc && pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          }
        } catch (err) {
          console.error('[Voice] Error handling answer:', err);
        }
      });

      /**
       * voice:ice-candidate — add a trickling ICE candidate from a peer.
       */
      socket.on('voice:ice-candidate', async ({ from, candidate }) => {
        if (cancelled) return;
        try {
          const pc = peerConnectionsRef.current.get(from);
          if (pc && candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          // Non-fatal: ICE candidates can arrive before remote desc is set
          console.warn('[Voice] ICE candidate error (may be benign):', err.message);
        }
      });

      // ── Join voice room ─────────────────────────────────────────────────
      if (!isJoinedRef.current) {
        isJoinedRef.current = true;
        socket.emit('voice:join', { roomId });
      }

      startSpeakingPoll();
      setIsConnected(true);
      setPermissionDenied(false);
    };

    init();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [socket, roomId]); // intentionally minimal deps — user is stable after login

  // ─────────────────────────────────────────────────────────────────────────
  // Mute / Unmute
  // ─────────────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted; // disabling the track sends silence
    });
    setIsMuted(newMuted);

    // When muting self, clear own speaking indicator immediately
    if (newMuted) {
      setVoiceUsers((prev) =>
        prev.map((u) =>
          u.userId === user?.id?.toString() ? { ...u, isSpeaking: false } : u
        )
      );
    }
  }, [user]);

  return { isMuted, toggleMute, voiceUsers, isConnected, permissionDenied };
}
