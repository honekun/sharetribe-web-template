'use strict';

jest.mock('./integrationSdk', () => ({
  getIntegrationSdk: jest.fn(),
}));
jest.mock('./whatsappService', () => ({
  getAdminPhone: jest.fn(),
  lookupUserPhone: jest.fn(),
}));
jest.mock('./notificationDelivery', () => ({
  deliverNotification: jest.fn(),
}));
jest.mock('./eshipTrackingService', () => ({
  processDueEshipTrackingNotifications: jest.fn().mockResolvedValue(0),
}));
jest.mock('./notificationConfig', () => ({
  isMarketingCampaignsEnabled: jest.fn(),
  isShippingLabelsEnabled: jest.fn(),
  isWelcomeEmailEnabled: jest.fn(),
  isWhatsAppEnabled: jest.fn(),
}));
jest.mock('./notificationMetrics', () => ({
  recordPollCompleted: jest.fn(),
  recordPollError: jest.fn(),
  recordPollStarted: jest.fn(),
}));
jest.mock('./eventPollerCursor', () => ({
  claimOwnership: jest.fn(),
  loadCursor: jest.fn(),
  releaseOwnership: jest.fn(),
  saveCursor: jest.fn(),
}));
jest.mock('./eventPollerLeadership', () => ({
  getLeadership: jest.fn(),
}));

const { getIntegrationSdk } = require('./integrationSdk');
const { getAdminPhone } = require('./whatsappService');
const { deliverNotification } = require('./notificationDelivery');
const {
  isMarketingCampaignsEnabled,
  isShippingLabelsEnabled,
  isWelcomeEmailEnabled,
  isWhatsAppEnabled,
} = require('./notificationConfig');
const { recordPollCompleted } = require('./notificationMetrics');
const { claimOwnership, loadCursor, releaseOwnership, saveCursor } = require('./eventPollerCursor');
const { getLeadership } = require('./eventPollerLeadership');
const { startPoller, stopPoller, pollEvents } = require('./eventPoller');

const event = ({
  id,
  sequenceId,
  eventType = 'listing/updated',
  resource = {},
  createdAt = '2026-07-17T12:00:00.000Z',
}) => ({
  id: { uuid: id },
  attributes: {
    createdAt,
    eventType,
    resource,
    sequenceId,
  },
});

describe('event poller cursor queries', () => {
  const leadership = {
    leaseId: 'test-owner:1:test-lease',
    ownerId: 'test-owner:1',
    onLeadershipLost: jest.fn(() => jest.fn()),
    release: jest.fn(),
    tryAcquire: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    claimOwnership.mockResolvedValue();
    loadCursor.mockResolvedValue({
      lastSequenceId: 40,
      recentEventIds: [],
    });
    releaseOwnership.mockResolvedValue();
    saveCursor.mockResolvedValue();
    deliverNotification.mockResolvedValue({ status: 'sent' });
    getAdminPhone.mockReturnValue('+525500000001');
    isWelcomeEmailEnabled.mockReturnValue(true);
    isShippingLabelsEnabled.mockReturnValue(false);
    isMarketingCampaignsEnabled.mockReturnValue(false);
    isWhatsAppEnabled.mockReturnValue(true);
    leadership.release.mockResolvedValue();
    leadership.tryAcquire.mockResolvedValue(true);
    getLeadership.mockReturnValue(leadership);
  });

  afterEach(async () => {
    await stopPoller();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('uses startAfterSequenceId for consecutive polls after restoring the cursor', async () => {
    const newUserResource = {
      attributes: {
        email: 'new-user@example.com',
        profile: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          publicData: { userType: 'vendedor' },
        },
      },
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          data: [
            event({
              id: 'event-41',
              sequenceId: 41,
              eventType: 'user/created',
              resource: newUserResource,
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [event({ id: 'event-42', sequenceId: 42 })],
        },
      })
      .mockResolvedValueOnce({ data: { data: [] } });
    getIntegrationSdk.mockReturnValue({ events: { query } });

    // startPoller restores the persisted cursor, as it would after an app restart.
    await startPoller();
    await pollEvents();
    await pollEvents();
    await pollEvents();

    expect(query).toHaveBeenNthCalledWith(1, {
      startAfterSequenceId: 40,
      perPage: 100,
    });
    expect(query).toHaveBeenNthCalledWith(2, {
      startAfterSequenceId: 41,
      perPage: 100,
    });
    expect(query).toHaveBeenNthCalledWith(3, {
      startAfterSequenceId: 42,
      perPage: 100,
    });
    for (const [params] of query.mock.calls) {
      expect(params).not.toHaveProperty('sequenceIdStart');
    }

    expect(deliverNotification).toHaveBeenCalledTimes(2);
    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-41',
        channel: 'brevo',
        templateName: 'seller_welcome',
        recipient: 'new-user@example.com',
      }),
      'test-owner:1:test-lease'
    );
    expect(deliverNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-41',
        channel: 'whatsapp',
        templateName: 'av_admin_new_user',
        recipient: '+525500000001',
      }),
      'test-owner:1:test-lease'
    );
    expect(saveCursor).toHaveBeenLastCalledWith(
      {
        lastSequenceId: 42,
        recentEventIds: ['event-41', 'event-42'],
      },
      'test-owner:1:test-lease'
    );
  });

  test('drains more than 100 events in one bounded poll', async () => {
    const allEvents = Array.from({ length: 150 }, (_unused, index) =>
      event({
        id: `backlog-${index + 41}`,
        sequenceId: index + 41,
        createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      })
    );
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          data: allEvents.slice(0, 100),
          meta: { totalItems: 150 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: allEvents.slice(100),
          meta: { totalItems: 50 },
        },
      });
    getIntegrationSdk.mockReturnValue({ events: { query } });

    await startPoller();
    await pollEvents({ maxPages: 5, pageDelayMs: 0 });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(1, {
      startAfterSequenceId: 40,
      perPage: 100,
    });
    expect(query).toHaveBeenNthCalledWith(2, {
      startAfterSequenceId: 140,
      perPage: 100,
    });
    expect(recordPollCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSequenceId: 190,
        pagesProcessed: 2,
        eventsProcessed: 150,
        remainingEventCount: 0,
        sequenceLagEvents: 0,
        backlogBoundHit: false,
      })
    );
    expect(saveCursor).toHaveBeenLastCalledWith(
      expect.objectContaining({ lastSequenceId: 190 }),
      'test-owner:1:test-lease'
    );
  });

  test('rolls back the page cursor when a delivery claim cannot be recorded', async () => {
    const query = jest.fn().mockResolvedValue({
      data: {
        data: [
          event({
            id: 'event-41-db-failure',
            sequenceId: 41,
            eventType: 'user/created',
            resource: {
              attributes: {
                email: 'database-failure@example.com',
                profile: {
                  firstName: 'Database',
                  lastName: 'Failure',
                  publicData: { userType: 'vendedor' },
                },
              },
            },
          }),
        ],
      },
    });
    getIntegrationSdk.mockReturnValue({ events: { query } });
    deliverNotification.mockRejectedValue(new Error('database unavailable'));

    await startPoller();
    await expect(pollEvents()).rejects.toThrow('database unavailable');

    expect(saveCursor).not.toHaveBeenCalled();
  });

  test('advances past a provider failure after its outcome is stored for operator retry', async () => {
    const query = jest.fn().mockResolvedValue({
      data: {
        data: [
          event({
            id: 'event-41-provider-failure',
            sequenceId: 41,
            eventType: 'user/created',
            resource: {
              attributes: {
                email: 'provider-failure@example.com',
                profile: {
                  firstName: 'Provider',
                  lastName: 'Failure',
                  publicData: { userType: 'vendedor' },
                },
              },
            },
          }),
        ],
      },
    });
    const recordedFailure = new Error('provider rejected request');
    recordedFailure.notificationOutcomeRecorded = true;
    getIntegrationSdk.mockReturnValue({ events: { query } });
    deliverNotification.mockRejectedValue(recordedFailure);

    await startPoller();
    await pollEvents();

    expect(saveCursor).toHaveBeenLastCalledWith(
      {
        lastSequenceId: 41,
        recentEventIds: ['event-41-provider-failure'],
      },
      'test-owner:1:test-lease'
    );
  });

  test('waits for an in-flight poll before releasing leadership on shutdown', async () => {
    let resolveQuery;
    const query = jest.fn(
      () =>
        new Promise(resolve => {
          resolveQuery = resolve;
        })
    );
    getIntegrationSdk.mockReturnValue({ events: { query } });
    await startPoller();

    const pollPromise = pollEvents();
    await Promise.resolve();
    const stopPromise = stopPoller();
    await Promise.resolve();

    expect(leadership.release).not.toHaveBeenCalled();

    resolveQuery({ data: { data: [] } });
    await pollPromise;
    await stopPromise;

    expect(saveCursor).toHaveBeenCalledWith(
      {
        lastSequenceId: 40,
        recentEventIds: [],
      },
      'test-owner:1:test-lease'
    );
    expect(leadership.release).toHaveBeenCalledTimes(1);
  });
});
