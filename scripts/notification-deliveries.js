'use strict';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
require('../server/env').configureEnv();

const os = require('os');

const {
  createDeliveryStore,
  retryNotification,
} = require('../server/services/notificationDelivery');
const { closePostgresPool } = require('../server/services/postgres');

function printUsage() {
  console.log(`Usage:
  yarn notifications:list [failed|unknown|processing|sent|pending]
  yarn notifications:retry <notification-key> [--confirm-unknown]

Unknown outcomes and stale processing claims require --confirm-unknown. Before using it, check the
provider dashboard because the original request may already have been accepted.`);
}

async function main() {
  const [command, value, ...flags] = process.argv.slice(2);
  const validList = command === 'list';
  const validRetry = command === 'retry' && value;
  if (!validList && !validRetry) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (command === 'list') {
    const store = createDeliveryStore();
    const rows = await store.list({ status: value || null });
    console.table(rows);
    return;
  }

  if (command === 'retry' && value) {
    const store = createDeliveryStore();
    const confirmUnknown = flags.includes('--confirm-unknown');
    const existing = await store.get(value);
    if (!existing) {
      throw new Error(`Notification ${value} does not exist`);
    }
    if (['unknown', 'processing'].includes(existing.status) && !confirmUnknown) {
      throw new Error(
        `Notification status is ${existing.status}; inspect the provider dashboard and rerun with --confirm-unknown only if a resend is safe`
      );
    }

    const result = await retryNotification(
      value,
      {
        confirmUnknown,
        claimedBy: `operator:${os.hostname()}:${process.pid}`,
      },
      store
    );
    if (!result) {
      throw new Error(
        'Notification is not retryable; only failed/pending, unknown, or processing claims older than the configured stale-claim threshold qualify'
      );
    }
    console.log(`[notification-delivery] Retry completed with status=${result.status}`);
    return;
  }
}

main()
  .catch(err => {
    console.error('[notification-delivery] Command failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() =>
    closePostgresPool().catch(err => {
      console.error('[notification-delivery] Pool shutdown failed:', err);
      process.exitCode = 1;
    })
  );
