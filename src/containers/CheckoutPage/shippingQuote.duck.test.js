import reducer, {
  fetchShippingQuote,
  QUOTE_REQUEST,
  QUOTE_SUCCESS,
  QUOTE_ERROR,
} from './shippingQuote.duck';

describe('shippingQuote reducer', () => {
  it('sets quoting on request', () => {
    expect(reducer(undefined, { type: QUOTE_REQUEST }).status).toBe('quoting');
  });

  it('stores the payload on success', () => {
    const payload = {
      quoteToken: 't',
      express: { amountSubunits: 11800 },
      estandar: null,
      rawRates: [],
    };
    const s = reducer(undefined, { type: QUOTE_SUCCESS, payload });
    expect(s.status).toBe('quoted');
    expect(s.quoteToken).toBe('t');
    expect(s.express.amountSubunits).toBe(11800);
  });

  it('stores the error code on error', () => {
    const s = reducer(undefined, { type: QUOTE_ERROR, payload: 'NO_ORIGIN' });
    expect(s.status).toBe('error');
    expect(s.errorCode).toBe('NO_ORIGIN');
  });
});

describe('fetchShippingQuote thunk', () => {
  const args = { listingId: 'l1', destination: { zip: '64000' }, buyerEmail: 'b@x.com' };

  afterEach(() => {
    delete global.window.fetch;
  });

  it('dispatches success on a 200 response', async () => {
    global.window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quoteToken: 't',
        express: { amountSubunits: 1 },
        estandar: null,
        rawRates: [],
      }),
    });
    const dispatched = [];
    await fetchShippingQuote(args)(a => dispatched.push(a));
    expect(dispatched.map(a => a.type)).toEqual([QUOTE_REQUEST, QUOTE_SUCCESS]);
  });

  it('dispatches error with the server code on a non-2xx response', async () => {
    global.window.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: 'NO_ORIGIN' }),
    });
    const dispatched = [];
    await fetchShippingQuote(args)(a => dispatched.push(a));
    expect(dispatched.map(a => a.type)).toEqual([QUOTE_REQUEST, QUOTE_ERROR]);
    expect(dispatched[1].payload).toBe('NO_ORIGIN');
  });

  it('dispatches ESHIP_ERROR when fetch rejects', async () => {
    global.window.fetch = jest.fn().mockRejectedValue(new Error('network'));
    const dispatched = [];
    await fetchShippingQuote(args)(a => dispatched.push(a));
    expect(dispatched[1].type).toBe(QUOTE_ERROR);
    expect(dispatched[1].payload).toBe('ESHIP_ERROR');
  });
});
