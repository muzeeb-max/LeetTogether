import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsOptions, generalLimiter } from './config/security.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import executionRoutes from './routes/executionRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import spotifyRoutes from './routes/spotifyRoutes.js';

const app = express();

// 1. Basic Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://sdk.scdn.co"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://api.dicebear.com", "https://images.unsplash.com", "https://i.scdn.co", "*.scdn.co"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5000", "https://judge0-ce.p.rapidapi.com", "https://api.spotify.com", "wss://*.spotify.com", "https://sdk.scdn.co"],
      frameSrc: ["'self'", "https://sdk.scdn.co"]
    }
  }
}));

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy for Render deployment (fixes ERR_PASSTRHOUGH_X_FORWARDED_FOR)
app.set('trust proxy', 1);

// Apply general rate limiting
app.use(generalLimiter);

// 2. Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ message: 'LeetTogether API is running successfully!' });
});

// 3. API Route Bindings
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/execution', executionRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/spotify', spotifyRoutes);

// 4. Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack || err.message);
  
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

// 5. 404 Route handler fallback
app.use((req, res) => {
  res.status(404).json({ message: `API route not found: ${req.originalUrl}` });
});

export default app;
