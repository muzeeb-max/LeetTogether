import axios from 'axios';
import { User } from '../models/index.js';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const REDIRECT_URI = `${FRONTEND_URL}/spotify-callback`;

export const getLoginUrl = (req, res) => {
  const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
    'user-read-currently-playing'
  ].join(' ');

  if (!SPOTIFY_CLIENT_ID) {
    // Return mock auth URL for local verification if client credentials aren't set
    const mockAuthUrl = `${FRONTEND_URL}/spotify-callback?code=mock_code_for_testing`;
    return res.json({ url: mockAuthUrl });
  }

  const spotifyAuthUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${SPOTIFY_CLIENT_ID}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.json({ url: spotifyAuthUrl });
};

export const handleCallback = async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ message: 'Authorization code is missing' });
  }

  try {
    let accessToken, refreshToken, expiresAt, spotifyUsername, spotifyProduct;

    if (code === 'mock_code_for_testing' || !SPOTIFY_CLIENT_ID) {
      accessToken = 'mock_access_token_123456789';
      refreshToken = 'mock_refresh_token_123456789';
      expiresAt = new Date(Date.now() + 3600 * 1000);
      spotifyUsername = 'mock_spotify_user';
      spotifyProduct = 'premium';
    } else {
      const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: REDIRECT_URI
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
          }
        }
      );

      const data = tokenResponse.data;
      accessToken = data.access_token;
      refreshToken = data.refresh_token;
      expiresAt = new Date(Date.now() + data.expires_in * 1000);

      const profileResponse = await axios.get('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      spotifyUsername = profileResponse.data.display_name || profileResponse.data.id;
      spotifyProduct = profileResponse.data.product;
    }

    await User.update({
      spotifyAccessToken: accessToken,
      spotifyRefreshToken: refreshToken,
      spotifyTokenExpiresAt: expiresAt,
      spotifyProduct,
      spotifyUsername
    }, {
      where: { id: req.user.id }
    });

    const updatedUser = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Spotify Callback Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Spotify authentication failed', error: error.message });
  }
};

export const getSpotifyToken = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.spotifyAccessToken) {
      return res.status(404).json({ message: 'Spotify account not connected' });
    }

    const isExpired = user.spotifyTokenExpiresAt && (new Date(user.spotifyTokenExpiresAt).getTime() - Date.now() < 5 * 60 * 1000);

    if (isExpired && user.spotifyRefreshToken) {
      if (user.spotifyRefreshToken === 'mock_refresh_token_123456789' || !SPOTIFY_CLIENT_ID) {
        const newExpiresAt = new Date(Date.now() + 3600 * 1000);
        await user.update({
          spotifyAccessToken: 'mock_access_token_refreshed_' + Date.now(),
          spotifyTokenExpiresAt: newExpiresAt
        });
      } else {
        const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', 
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.spotifyRefreshToken
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
            }
          }
        );

        const data = tokenResponse.data;
        const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);
        await user.update({
          spotifyAccessToken: data.access_token,
          spotifyRefreshToken: data.refresh_token || user.spotifyRefreshToken,
          spotifyTokenExpiresAt: newExpiresAt
        });
      }
    }

    const freshUser = await User.findByPk(req.user.id);
    res.json({
      accessToken: freshUser.spotifyAccessToken,
      product: freshUser.spotifyProduct,
      username: freshUser.spotifyUsername,
      expiresAt: freshUser.spotifyTokenExpiresAt
    });
  } catch (error) {
    console.error('Spotify token refresh error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to retrieve or refresh Spotify token' });
  }
};

export const disconnectSpotify = async (req, res) => {
  try {
    await User.update({
      spotifyAccessToken: null,
      spotifyRefreshToken: null,
      spotifyTokenExpiresAt: null,
      spotifyProduct: null,
      spotifyUsername: null
    }, {
      where: { id: req.user.id }
    });

    const updatedUser = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json({ message: 'Spotify disconnected successfully', user: updatedUser });
  } catch (error) {
    console.error('Spotify Disconnect Error:', error.message);
    res.status(500).json({ message: 'Failed to disconnect Spotify' });
  }
};
