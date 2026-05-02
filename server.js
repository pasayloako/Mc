import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = (process.env.PORT || 3000) as number;

// Middleware
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : 'http://localhost:3000' }));
app.use(express.static(path.join(__dirname, 'public'))); // Serve public/index.html

// Rate limiting
const limiter = rateLimit({ windowMs: 60 * 1000, max: 50 });
app.use('/api/', limiter);

// Secure /api/chat proxy
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 500) {
      return res.status(400).json({ error: 'Valid prompt required' });
    }

    const bibleAiUrl = process.env.BIBLE_AI_URL!;
    const apiKey = process.env.API_KEY!;

    const response = await axios.post(bibleAiUrl, { prompt }, {
      headers: { 'apikey': apiKey },
      timeout: 10000,
    });

    res.json({ reply: response.data.response || response.data.reply || response.data });
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'Service error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});
