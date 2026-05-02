import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & parsing middleware
app.use(helmet({
  contentSecurityPolicy: false  // Disable if CSP blocks frontend JS
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS - flexible for dev/prod
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || 'https://yourapp.onrender.com'
    : 'http://localhost:3000',
  credentials: true
};
app.use(cors(corsOptions));

// Rate limiting: 100/min IP, tighter for API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Rate limit hit. Try again in 1 min.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Static files (public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req: Response) => res.status(200).json({ status: 'OK' }));

// Secure Bible AI proxy - frontend calls /api/chat
app.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;
    
    // Strict validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0 || prompt.length > 1000) {
      return res.status(400).json({ error: 'Valid prompt required (1-1000 chars)' });
    }

    const cleanPrompt = prompt.trim();
    const bibleAiUrl = process.env.BIBLE_AI_URL;
    const apiKey = process.env.API_KEY;

    if (!bibleAiUrl || !apiKey) {
      return res.status(500).json({ error: 'Service config error' });
    }

    // Proxy with timeout & error handling
    const response = await axios.post(bibleAiUrl, { prompt: cleanPrompt }, {
      headers: { 
        'Content-Type': 'application/json',
        'apikey': apiKey 
      },
      timeout: 15000,  // 15s for AI responses
      validateStatus: () => true  // Handle all status codes
    });

    // Extract reply safely
    const reply = response.data?.response || 
                  response.data?.reply || 
                  response.data?.message || 
                  response.data || 
                  'Bible AI response unavailable.';

    res.json({ 
      success: true, 
      reply: String(reply).substring(0, 4000)  // Cap response size
    });

  } catch (error: any) {
    console.error('Proxy error:', error.message);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({ error: 'Request timeout' });
      }
      return res.status(error.response?.status || 502).json({ 
        error: 'Bible AI service error' 
      });
    }
    
    res.status(500).json({ error: 'Internal error' });
  }
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Bible AI Backend running on port ${PORT}`);
  console.log(`Env: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    console.log('Process terminated');
  });
});
