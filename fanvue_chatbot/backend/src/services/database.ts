import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

let pool: pg.Pool;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initDatabase() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    client.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }

  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error('Database not initialized. Call initDatabase() first.');
  return pool;
}

export async function runSchema() {
  if (!pool) throw new Error('Database not initialized');

  try {
    const schemaPath = path.join(__dirname, '../../../..', 'DATABASE_SCHEMA.sql');
    if (!fs.existsSync(schemaPath)) {
      console.warn(`⚠️ Schema file not found at ${schemaPath}. Skipping initialization.`);
      console.warn('   Run migrations manually or provide DATABASE_SCHEMA.sql');
      return;
    }
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split by semicolon and execute separately to handle CREATE FUNCTION
    const statements = schema.split(';').filter((stmt) => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await pool.query(statement);
      }
    }

    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Failed to initialize schema:', error);
    throw error;
  }
}

// Helper functions for common queries
export async function queryOne<T>(sql: string, params: any[] = []): Promise<T | null> {
  const result = await getPool().query(sql, params);
  return result.rows[0] || null;
}

export async function queryMany<T>(sql: string, params: any[] = []): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows;
}

export async function execute(sql: string, params: any[] = []): Promise<number> {
  const result = await getPool().query(sql, params);
  return result.rowCount || 0;
}
