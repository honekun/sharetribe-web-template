'use strict';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}
require('../server/env').configureEnv();

const { EventPollerCursorStore } = require('../server/services/eventPollerCursor');
const { EventPollerLeadership } = require('../server/services/eventPollerLeadership');
const {
  NotificationDeliveryStore,
  notificationKey,
} = require('../server/services/notificationDelivery');
const { closePostgresPool, getPostgresPool } = require('../server/services/postgres');

async function verify() {
  const pool = getPostgresPool();
  const firstLeadership = new EventPollerLeadership({
    pool,
    ownerId: `db-verify-first:${process.pid}`,
  });
  const secondLeadership = new EventPollerLeadership({
    pool,
    ownerId: `db-verify-second:${process.pid}`,
  });
  const firstStore = new EventPollerCursorStore(pool);
  const secondStore = new EventPollerCursorStore(pool);
  const firstDeliveryStore = new NotificationDeliveryStore(pool);
  const secondDeliveryStore = new NotificationDeliveryStore(pool);
  const verificationDelivery = {
    eventId: `db-verify-${process.pid}-${Date.now()}`,
    channel: 'brevo',
    templateName: 'db_verify',
    recipient: 'db-verify@example.com',
    payload: {
      email: 'db-verify@example.com',
      firstName: 'Database',
      lastName: 'Verification',
    },
  };
  const verificationKey = notificationKey(verificationDelivery);

  let originalCursor = null;
  let claimedStore = null;
  let claimedOwnerId = null;

  try {
    if (!(await firstLeadership.tryAcquire())) {
      throw new Error('Cannot verify while another notification poller owns the database lock');
    }
    if (await secondLeadership.tryAcquire()) {
      throw new Error('PostgreSQL allowed two notification poller leaders');
    }

    originalCursor = await firstStore.loadCursor();
    claimedStore = firstStore;
    claimedOwnerId = firstLeadership.leaseId;
    await firstStore.claimOwnership(claimedOwnerId);
    await firstStore.saveCursor(
      {
        lastSequenceId: 424242,
        recentEventIds: ['db-verify-event'],
      },
      claimedOwnerId
    );
    await firstStore.releaseOwnership(claimedOwnerId);
    claimedStore = null;
    claimedOwnerId = null;
    await firstLeadership.release();

    if (!(await secondLeadership.tryAcquire())) {
      throw new Error('Replacement poller could not acquire the released database lock');
    }
    claimedStore = secondStore;
    claimedOwnerId = secondLeadership.leaseId;
    await secondStore.claimOwnership(claimedOwnerId);

    const restoredCursor = await secondStore.loadCursor();
    if (
      restoredCursor.lastSequenceId !== 424242 ||
      restoredCursor.recentEventIds.length !== 1 ||
      restoredCursor.recentEventIds[0] !== 'db-verify-event'
    ) {
      throw new Error('Replacement poller did not load the cursor saved by the first process');
    }

    await secondStore.saveCursor(originalCursor, claimedOwnerId);
    await secondStore.releaseOwnership(claimedOwnerId);
    claimedStore = null;
    claimedOwnerId = null;
    await secondLeadership.release();

    const claims = await Promise.all([
      firstDeliveryStore.claim(verificationDelivery, 'db-verify-worker-1'),
      secondDeliveryStore.claim(verificationDelivery, 'db-verify-worker-2'),
    ]);
    const acceptedClaims = claims.filter(Boolean);
    if (acceptedClaims.length !== 1) {
      throw new Error(`Expected one atomic notification claim, received ${acceptedClaims.length}`);
    }
    await firstDeliveryStore.finish(
      acceptedClaims[0].notification_key,
      acceptedClaims[0].claim_token,
      { status: 'unknown', error: 'db-verification-only' }
    );
    const unsafeRetry = await firstDeliveryStore.prepareRetry(verificationKey);
    if (unsafeRetry) {
      throw new Error('An unknown notification was retryable without explicit confirmation');
    }
    const preparedRetry = await firstDeliveryStore.prepareRetry(verificationKey, {
      confirmUnknown: true,
    });
    if (!preparedRetry) {
      throw new Error('An explicitly confirmed unknown notification could not be prepared');
    }
    const retryClaim = await firstDeliveryStore.claim(
      verificationDelivery,
      'db-verify-operator-retry'
    );
    if (!retryClaim) {
      throw new Error('The prepared operator retry could not be claimed');
    }
    await firstDeliveryStore.finish(retryClaim.notification_key, retryClaim.claim_token, {
      status: 'sent',
      providerMessageId: 'db-verification-only',
    });
    const replayClaim = await secondDeliveryStore.claim(verificationDelivery, 'db-verify-replay');
    if (replayClaim) {
      throw new Error('A sent notification was claimable during replay');
    }

    console.log(
      '[notification-db] Verified leadership, cursor restore, atomic deduplication, and confirmed unknown retry'
    );
  } finally {
    if (claimedStore && claimedOwnerId) {
      if (originalCursor) {
        await claimedStore.saveCursor(originalCursor, claimedOwnerId).catch(() => {});
      }
      await claimedStore.releaseOwnership(claimedOwnerId).catch(() => {});
    }
    await Promise.allSettled([firstLeadership.release(), secondLeadership.release()]);
    await pool
      .query('DELETE FROM av_notification_deliveries WHERE notification_key = $1', [
        verificationKey,
      ])
      .catch(() => {});
  }
}

verify()
  .catch(err => {
    console.error('[notification-db] Verification failed:', err);
    process.exitCode = 1;
  })
  .finally(() =>
    closePostgresPool().catch(err => {
      console.error('[notification-db] Pool shutdown failed:', err);
      process.exitCode = 1;
    })
  );
