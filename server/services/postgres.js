'use strict';

const { Pool } = require('pg');

const DEFAULT_POOL_SIZE = 5;
const APPLICATION_NAME = 'archivo-vintach-notifications';

let pool = null;

function parsePoolSize(value) {
  if (value == null || value === '') return DEFAULT_POOL_SIZE;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2) {
    throw new Error('AV_DATABASE_POOL_MAX must be an integer greater than or equal to 2');
  }
  return parsed;
}

function getPostgresPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required for the notification event poller; run `yarn db:setup` locally'
    );
  }

  pool = new Pool({
    connectionString,
    max: parsePoolSize(process.env.AV_DATABASE_POOL_MAX),
    application_name: APPLICATION_NAME,
  });
  pool.on('error', err => {
    console.error('[postgres] Unexpected idle client error:', err);
  });

  return pool;
}

async function closePostgresPool() {
  if (!pool) return;

  const poolToClose = pool;
  pool = null;
  await poolToClose.end();
}

module.exports = {
  APPLICATION_NAME,
  closePostgresPool,
  getPostgresPool,
  parsePoolSize,
};
