import { initDatabase, runSchema } from '../services/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    console.log('🔄 Initializing database...');
    await initDatabase();

    console.log('📋 Running schema...');
    await runSchema();

    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
}

main();
