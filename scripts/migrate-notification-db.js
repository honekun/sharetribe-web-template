'use strict';

const fs = require('fs');
const path = require('path');

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
require('../server/env').configureEnv();

const { closePostgresPool, getPostgresPool } = require('../server/services/postgres');

const migrationsPath = path.resolve(__dirname, '../server/migrations');

async function migrate() {
  const pool = getPostgresPool();
  const migrationNames = (await fs.promises.readdir(migrationsPath))
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const migrationName of migrationNames) {
    const sql = await fs.promises.readFile(path.join(migrationsPath, migrationName), 'utf8');
    await pool.query(sql);
    console.log(`[notification-db] Migration complete: ${migrationName}`);
  }
}

migrate()
  .catch(err => {
    console.error('[notification-db] Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() =>
    closePostgresPool().catch(err => {
      console.error('[notification-db] Pool shutdown failed:', err);
      process.exitCode = 1;
    })
  );
