'use strict';

const mockQuery = jest.fn();

jest.mock('../services/integrationSdk', () => ({
  getIntegrationSdk: () => ({ users: { query: (...args) => mockQuery(...args) } }),
}));

const handler = require('./topbar-local-design-users');

const storeUser = (uuid, displayName, extra = {}) => ({
  id: { uuid },
  attributes: {
    profile: {
      displayName,
      publicData: { userType: 'vendedor-tienda' },
      metadata: { localDesign: true },
      ...extra,
    },
  },
});

const page = (users, totalPages = 1) => ({ data: { data: users, meta: { totalPages } } });

const mockRes = () => {
  const res = { statusCode: 200 };
  res.status = jest.fn(code => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn(body => {
    res.body = body;
    return res;
  });
  return res;
};

const callHandler = () => {
  const res = mockRes();
  return handler({}, res).then(() => res);
};

describe('topbar local-design users endpoint', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    handler.resetForTests();
  });

  it('returns the store users that are flagged for local design', async () => {
    mockQuery.mockResolvedValue(
      page([
        storeUser('u-2', 'Zeta'),
        storeUser('u-1', 'Alfa'),
        // Not flagged for local design.
        storeUser('u-3', 'Beta', { metadata: {} }),
        // Not a store.
        {
          id: { uuid: 'u-4' },
          attributes: {
            profile: {
              displayName: 'Buyer',
              publicData: { userType: 'comprador' },
              metadata: { localDesign: true },
            },
          },
        },
      ])
    );

    const res = await callHandler();

    expect(res.body.users).toEqual([{ id: 'u-1', text: 'Alfa' }, { id: 'u-2', text: 'Zeta' }]);
  });

  it('accepts the other truthy spellings of the localDesign flag', async () => {
    mockQuery.mockResolvedValue(
      page([
        storeUser('u-1', 'One', { metadata: { localDesign: 'true' } }),
        storeUser('u-2', 'Two', { metadata: { localDesign: 1 } }),
        storeUser('u-3', 'Three', {
          metadata: {},
          publicData: { userType: 'vendedor-tienda', localDesign: '1' },
        }),
        storeUser('u-4', 'Four', { metadata: { localDesign: false } }),
      ])
    );

    const res = await callHandler();

    // Order comes from the display-name sort, so compare the set.
    expect(res.body.users.map(u => u.id).sort()).toEqual(['u-1', 'u-2', 'u-3']);
  });

  it('narrows the query by pub_userType', async () => {
    mockQuery.mockResolvedValue(page([storeUser('u-1', 'Alfa')]));

    await callHandler();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0]).toMatchObject({ pub_userType: 'vendedor-tienda' });
  });

  it('falls back to reading every user when the filter has no schema', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('400 unknown query parameter pub_userType'))
      .mockResolvedValueOnce(page([storeUser('u-1', 'Alfa')]));

    const res = await callHandler();

    expect(res.body.users).toEqual([{ id: 'u-1', text: 'Alfa' }]);
    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0].pub_userType).toBeUndefined();
  });

  it('stops retrying the unsupported filter on later loads', async () => {
    mockQuery
      .mockRejectedValueOnce(new Error('no schema'))
      .mockResolvedValue(page([storeUser('u-1', 'Alfa')]));

    await callHandler();

    // Expire the cached list the way a real process does, without forgetting
    // that the filter is unusable.
    handler.resetForTests({ keepFilterSupport: true });
    mockQuery.mockClear();
    await callHandler();

    // One unfiltered query, rather than a rejected filtered one plus a retry.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery.mock.calls[0][0].pub_userType).toBeUndefined();
  });

  it('serves later requests from the cache', async () => {
    mockQuery.mockResolvedValue(page([storeUser('u-1', 'Alfa')]));

    await callHandler();
    await callHandler();

    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent requests on a cold cache into one load', async () => {
    let resolveQuery;
    mockQuery.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveQuery = () => resolve(page([storeUser('u-1', 'Alfa')]));
        })
    );

    const first = callHandler();
    const second = callHandler();
    const third = callHandler();

    resolveQuery();
    const responses = await Promise.all([first, second, third]);

    // One scan, and every caller still gets the list.
    expect(mockQuery).toHaveBeenCalledTimes(1);
    responses.forEach(res => expect(res.body.users).toEqual([{ id: 'u-1', text: 'Alfa' }]));
  });

  it('reports a failure and lets the next request retry', async () => {
    mockQuery.mockRejectedValue(new Error('integration down'));
    const res = await callHandler();

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'failed_to_load_users' });

    mockQuery.mockReset();
    mockQuery.mockResolvedValue(page([storeUser('u-1', 'Alfa')]));
    const retry = await callHandler();
    expect(retry.body.users).toEqual([{ id: 'u-1', text: 'Alfa' }]);
  });

  it('walks every page of results', async () => {
    mockQuery
      .mockResolvedValueOnce(page([storeUser('u-1', 'Alfa')], 2))
      .mockResolvedValueOnce(page([storeUser('u-2', 'Beta')], 2));

    const res = await callHandler();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery.mock.calls[1][0]).toMatchObject({ page: 2 });
    expect(res.body.users.map(u => u.id)).toEqual(['u-1', 'u-2']);
  });
});
