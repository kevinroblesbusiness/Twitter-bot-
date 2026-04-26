import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { initDatabase } from './services/database.js';
import { initRedis } from './services/redis.js';
import { setupWebhookHandler } from './api/webhooks.js';
import { setupAuthRoutes } from './api/auth.js';
import { setupCreatorRoutes } from './api/creators.js';
import { setupFanRoutes } from './api/fans.js';
import { setupMessageRoutes } from './api/messages.js';
import { startMessageWorker } from './services/message-worker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', setupAuthRoutes());
app.use('/api/creators', setupCreatorRoutes());
app.use('/api/fans', setupFanRoutes());
app.use('/api/messages', setupMessageRoutes());
app.use('/webhooks', setupWebhookHandler());

// Error handling
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: err.status || 500,
  });
});

// Start server
async function start() {
  try {
    console.log('🚀 Starting Fanvue AI Chatbot Backend...');

    // Initialize services
    console.log('📦 Initializing database...');
    await initDatabase();

    console.log('🔴 Initializing Redis...');
    const redis = await initRedis();

    console.log('⚙️ Starting message processing worker...');
    startMessageWorker(redis);

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📝 API ready for webhooks at http://localhost:${PORT}/webhooks/fanvue`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
