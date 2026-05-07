
import 'dotenv/config';
/**
 * @fileOverview Автономная точка входа для фонового воркера.
 */

import { startEngine } from '../lib/crawler/engine';

if (!process.env.DATABASE_URL) {
  console.error('[Worker] FATAL: DATABASE_URL environment variable is not set!');
  process.exit(1);
}

async function bootstrap() {
  console.log('==================================================');
  console.log('   HUMANGO BOT WORKER SERVICE v1.6                ');
  console.log('   Status: Bootstraping...                        ');
  console.log('==================================================');
  
  try {
    await startEngine();
  } catch (error: any) {
    console.error('[Worker] CRITICAL UNHANDLED ERROR:', error.stack || error);
    process.exit(1);
  }
}

// Graceful Shutdown
const shutdown = () => {
  console.log('\n[Worker] Termination signal received. Stopping...');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

bootstrap();
