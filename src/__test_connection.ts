import { pool } from './db/connection';

async function testConnection() {
  console.log('Testing database connection...');
  try {
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
