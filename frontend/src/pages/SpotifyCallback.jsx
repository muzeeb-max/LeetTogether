import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { musicAPI  } from '../services/api';

const SpotifyCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      spotifyAPI.callback(code)
        .then(() => {
          const lastRoom = localStorage.getItem('lastRoomId');
          if (lastRoom) {
            navigate(`/room/${lastRoom}`);
          } else {
            navigate('/');
          }
        })
        .catch((err) => {
          console.error('Error exchanging Spotify authorization code', err);
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center text-[#FFFFFF] font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-[#00B8A3] border-t-transparent rounded-full animate-spin" />
        <h2 className="text-sm font-semibold">Connecting your Spotify account...</h2>
        <p className="text-xs text-[#A0A0A0]">Please wait while we sync with Spotify.</p>
      </div>
    </div>
  );
};

export default SpotifyCallback;
