'use strict';

jest.mock('../services/notificationReadiness', () => ({
  getNotificationReadiness: jest.fn(),
}));

const { getNotificationReadiness } = require('../services/notificationReadiness');
const router = require('./notifications');

const createRes = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    set: jest.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
};

const handlersFor = path =>
  router.stack.find(layer => layer.route?.path === path).route.stack.map(layer => layer.handle);

describe('notification readiness routes', () => {
  const detailedReadiness = {
    ready: true,
    config: { missing: ['SECRET_ENV_NAME'] },
    database: { lastSequenceId: 123, deliveriesByStatus: { sent: 5 } },
    metrics: { eventsProcessed: 10 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.AV_NOTIFICATION_READINESS_TOKEN;
    getNotificationReadiness.mockResolvedValue(detailedReadiness);
  });

  test('returns only the readiness boolean from the public endpoint', async () => {
    const [handler] = handlersFor('/readiness');
    const res = createRes();

    await handler({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ready: true });
  });

  test('preserves the public 503 status without exposing failed checks', async () => {
    getNotificationReadiness.mockResolvedValue({ ...detailedReadiness, ready: false });
    const [handler] = handlersFor('/readiness');
    const res = createRes();

    await handler({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ ready: false });
  });

  test('rejects detailed diagnostics when the token is missing or incorrect', () => {
    process.env.AV_NOTIFICATION_READINESS_TOKEN = 'configured-secret';
    const [authorize] = handlersFor('/readiness/details');
    const next = jest.fn();

    for (const authorization of [undefined, 'Bearer wrong-secret', 'configured-secret']) {
      const res = createRes();
      authorize({ get: jest.fn(() => authorization) }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ ready: false, error: 'unauthorized' });
    }
    expect(next).not.toHaveBeenCalled();
  });

  test('does not expose diagnostics when no server token is configured', () => {
    const [authorize] = handlersFor('/readiness/details');
    const res = createRes();
    const next = jest.fn();

    authorize({ get: jest.fn(() => 'Bearer any-token') }, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns uncached detailed diagnostics for a valid bearer token', async () => {
    process.env.AV_NOTIFICATION_READINESS_TOKEN = 'configured-secret';
    const [authorize, handler] = handlersFor('/readiness/details');
    const req = { get: jest.fn(() => 'Bearer configured-secret') };
    const res = createRes();
    const next = jest.fn();

    authorize(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    await handler(req, res);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(detailedReadiness);
  });
});
