'use strict';

jest.mock('../services/notificationConfig', () => ({
  isEshipTrackingEmailsEnabled: jest.fn(() => true),
}));
jest.mock('../services/eshipTrackingStore', () => ({
  createEshipTrackingStore: jest.fn(),
}));

const { isEshipTrackingEmailsEnabled } = require('../services/notificationConfig');
const { createEshipTrackingStore } = require('../services/eshipTrackingStore');
const {
  eshipWebhook,
  isPickedUpEvent,
  parseEventTimestamp,
  secretMatches,
} = require('./eship-webhook');

const SECRET = 's'.repeat(32);
const createRes = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const validBody = {
  object_id: '60e37902e86e1',
  carrier: 'FEDEX',
  tracking_number: '281115007045',
  provider: 'FEDEX',
  status: 'TRANSIT',
  substatus: 'picked_up',
  timestamp: '2026-08-14 12:00:00',
  timezone: '-06:00',
};

describe('eShip tracking webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ESHIP_WEBHOOK_SECRET = SECRET;
    isEshipTrackingEmailsEnabled.mockReturnValue(true);
    createEshipTrackingStore.mockReturnValue({
      enqueue: jest.fn().mockResolvedValue({ id: 1, duplicate: false }),
    });
  });

  test('uses constant-time-compatible secret comparison and parses the documented timestamp', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches('wrong', SECRET)).toBe(false);
    expect(parseEventTimestamp('2026-08-14 12:00:00', '-06:00')).toBe('2026-08-14T18:00:00.000Z');
    expect(parseEventTimestamp('bad-date', '-06:00')).toBeNull();
    expect(isPickedUpEvent(validBody)).toBe(true);
  });

  test('rejects an invalid secret before touching the database', async () => {
    const res = createRes();
    await eshipWebhook({ query: { secret: 'wrong' }, body: validBody }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(createEshipTrackingStore).not.toHaveBeenCalled();
  });

  test('accepts the shared secret from the webhook header when the URL carries none', async () => {
    const store = { enqueue: jest.fn().mockResolvedValue({ id: 1, duplicate: false }) };
    createEshipTrackingStore.mockReturnValue(store);
    const res = createRes();

    await eshipWebhook(
      { headers: { 'x-av-webhook-secret': SECRET }, query: {}, body: validBody },
      res
    );

    expect(store.enqueue).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ ok: true, queued: true, duplicate: false });
  });

  test('rejects a wrong header secret when the URL carries none', async () => {
    const res = createRes();

    await eshipWebhook(
      { headers: { 'x-av-webhook-secret': 'wrong' }, query: {}, body: validBody },
      res
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(createEshipTrackingStore).not.toHaveBeenCalled();
  });

  test('keeps accepting the query secret while a stale header is still configured', async () => {
    const res = createRes();

    await eshipWebhook(
      { headers: { 'x-av-webhook-secret': 'stale' }, query: { secret: SECRET }, body: validBody },
      res
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ ok: true, queued: true, duplicate: false });
  });

  test('acknowledges unrelated tracking statuses without enqueueing them', async () => {
    const res = createRes();
    await eshipWebhook(
      {
        query: { secret: SECRET },
        body: { ...validBody, substatus: 'in_transit' },
      },
      res
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ ok: true, ignored: true });
    expect(createEshipTrackingStore).not.toHaveBeenCalled();
  });

  test('durably enqueues a verified-shape picked-up event', async () => {
    const store = { enqueue: jest.fn().mockResolvedValue({ id: 1, duplicate: false }) };
    createEshipTrackingStore.mockReturnValue(store);
    const res = createRes();

    await eshipWebhook({ query: { secret: SECRET }, body: validBody }, res);

    expect(store.enqueue).toHaveBeenCalledWith({
      shipmentId: '60e37902e86e1',
      eventType: 'transit-picked-up',
      eventAt: '2026-08-14T18:00:00.000Z',
      trackingNumber: '281115007045',
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({ ok: true, queued: true, duplicate: false });
  });

  test('returns success for duplicate provider deliveries', async () => {
    createEshipTrackingStore.mockReturnValue({
      enqueue: jest.fn().mockResolvedValue({ id: 1, duplicate: true, status: 'sent' }),
    });
    const res = createRes();

    await eshipWebhook({ query: { secret: SECRET }, body: validBody }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, queued: false, duplicate: true });
  });

  test('returns 404 when the feature is disabled', async () => {
    isEshipTrackingEmailsEnabled.mockReturnValue(false);
    const res = createRes();

    await eshipWebhook({ query: { secret: SECRET }, body: validBody }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(createEshipTrackingStore).not.toHaveBeenCalled();
  });
});
