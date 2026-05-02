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

// Fix __dirname (important for TypeScript / ES modules)
const __dirnameResolved = path.resolve();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
app.use('/api/', apiLimiter);

// ✅ Serve static files
app.use(express.static(path.join(__dirnameResolved, 'public')));

// ✅ Root route (THIS WAS MISSING)
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirnameResolved, 'public', 'index.html'));
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK' });
});

// Proxy endpoint
app.post('/api/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Valid prompt required' });
    }

    const bibleAiUrl = process.env.BIBLE_AI_URL;
    const apiKey = process.env.API_KEY;

    if (!bibleAiUrl || !apiKey) {
      return res.status(500).json({ error: 'Missing environment configuration' });
    }

    const response = await axios.post(
      bibleAiUrl,
      { prompt },
      {
        headers: { apikey: apiKey },
        timeout: 15000
      }
    );

    res.json({
      reply:
        response.data.response ||
        response.data.reply ||
        response.data
    });

  } catch (error: any) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: 'Bible AI service error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
