const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  is_group BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_members (
  conversation_id INT REFERENCES conversations(id),
  user_id INT REFERENCES users(id),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id),
  sender_id INT REFERENCES users(id),
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages (conversation_id, created_at DESC);
`;

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log('✅ الجداول تخلقو بنجاح!');
  } catch (err) {
    console.error('❌ وقع خطأ:', err.message);
  } finally {
    await client.end();
  }
}

run();