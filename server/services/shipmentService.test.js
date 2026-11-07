'use strict';

jest.mock('../api-util/eshipClient');
jest.mock('./shippingLabelStore');
jest.mock('./notificationConfig', () => ({
  isShippingLabelsEnabled: jest.fn(() => true),
}));

const eship = require('../api-util/eshipClient');
const { createShippingLabelStore } = require('./shippingLabelStore');
const { isShippingLabelsEnabled } = require('./notificationConfig');
const {
  buyLabelForTransaction,
  isLabelPurchaseAllowed,
  maybeBuyLabelForEvent,
  resolveLabelShippingRecord,
  validateShipment,
} = require('./shipmentService');

const makeSdk = () => ({
  transactions: { updateMetadata: jest.fn().mockResolvedValue({}) },
});

const money = (amount, currency = 'MXN') => ({ amount, currency });
const itemLine = {
  code: 'line-item/item',
  unitPrice: money(50000),
  lineTotal: money(50000),
  quantity: 1,
  includeFor: ['customer', 'provider'],
  reversal: false,
};
const shippingFeeLine = record => ({
  code: 'line-item/shipping-fee',
  unitPrice: money(record.amountSubunits, record.currency),
  lineTotal: money(record.amountSubunits, record.currency),
  quantity: 1,
  includeFor: ['customer'],
  reversal: false,
});

// `avShipping` is the server-written metadata record; `legacyAvShipping` is the
// protectedData copy older transactions carry. Line items charge the recorded
// shipping price unless a test overrides them.
const makeTx = ({
  avShipping,
  legacyAvShipping,
  avLabel,
  lineItems,
  lastTransition = 'transition/confirm-payment',
  transitions = [{ transition: 'transition/confirm-payment' }],
} = {}) => {
  const charged = avShipping || legacyAvShipping;
  return {
    id: { uuid: 'tx-1' },
    attributes: {
      protectedData: legacyAvShipping ? { avShipping: legacyAvShipping } : {},
      metadata: {
        ...(avLabel ? { avLabel } : {}),
        ...(avShipping ? { avShipping } : {}),
      },
      lineItems: lineItems || (charged ? [itemLine, shippingFeeLine(charged)] : [itemLine]),
      lastTransition,
      transitions,
    },
  };
};

const RATE = {
  bucket: 'nacionalExpress',
  quot_id: 'quot-9',
  rate_id: 'rate-123',
  carrier: 'Estafeta',
  servicelevel: 'Express',
  amountSubunits: 15000,
  currency: 'MXN',
};

const SHIPMENT = {
  status: 'SUCCESS',
  object_id: 'ship-abc',
  tracking_number: 'TRK-777',
  label_url: 'https://eship/labels/abc.pdf',
};

const makeStore = ({
  claim = { claim_token: 'claim-1' },
  row = null,
  finish = jest.fn().mockResolvedValue(),
} = {}) => ({
  claim: jest.fn().mockResolvedValue(claim),
  finish,
  get: jest.fn().mockResolvedValue(row),
});

beforeEach(() => {
  jest.clearAllMocks();
  isShippingLabelsEnabled.mockReturnValue(true);
  eship.describeEshipError.mockImplementation(error => `EshipError: ${error.message}`);
});

describe('label eligibility', () => {
  it('allows paid active transactions', () => {
    expect(isLabelPurchaseAllowed(makeTx({ avShipping: RATE }))).toBe(true);
  });

  it('rejects transactions before payment and after cancellation', () => {
    expect(
      isLabelPurchaseAllowed(
        makeTx({
          avShipping: RATE,
          lastTransition: 'transition/request-payment',
          transitions: [{ transition: 'transition/request-payment' }],
        })
      )
    ).toBe(false);
    expect(
      isLabelPurchaseAllowed(
        makeTx({
          avShipping: RATE,
          lastTransition: 'transition/cancel',
          transitions: [
            { transition: 'transition/confirm-payment' },
            { transition: 'transition/cancel' },
          ],
        })
      )
    ).toBe(false);
  });
});

describe('buyLabelForTransaction', () => {
  it('claims first, buys with rate_id only, and records the durable purchase', async () => {
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const sdk = makeSdk();
    const store = makeStore();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: RATE }), { store });

    expect(store.claim).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      rateId: 'rate-123',
      claimedBy: 'event-poller',
      force: false,
      confirmUnknown: false,
    });
    expect(eship.createShipment).toHaveBeenCalledWith({ rateId: 'rate-123' });
    expect(store.finish).toHaveBeenCalledWith(
      'tx-1',
      'claim-1',
      expect.objectContaining({ status: 'purchased', shipmentData: label })
    );
    expect(label).toMatchObject({
      status: 'purchased',
      shipmentId: 'ship-abc',
      trackingNumber: 'TRK-777',
      labelUrl: 'https://eship/labels/abc.pdf',
    });
    expect(sdk.transactions.updateMetadata).toHaveBeenCalledWith({
      id: { uuid: 'tx-1' },
      metadata: { avLabel: label },
    });
  });

  it('returns an existing metadata purchase without opening a database connection', async () => {
    const existing = { status: 'purchased', labelUrl: 'https://x/y.pdf' };
    const label = await buyLabelForTransaction(
      makeSdk(),
      makeTx({ avShipping: RATE, avLabel: existing })
    );

    expect(label).toBe(existing);
    expect(createShippingLabelStore).not.toHaveBeenCalled();
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('does not call eShip when another request owns the claim', async () => {
    const processing = {
      transaction_id: 'tx-1',
      rate_id: 'rate-123',
      status: 'processing',
      updated_at: '2026-07-20T00:00:00.000Z',
    };
    const store = makeStore({ claim: null, row: processing });

    const label = await buyLabelForTransaction(makeSdk(), makeTx({ avShipping: RATE }), { store });

    expect(label).toMatchObject({ status: 'processing', rate_id: 'rate-123' });
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('recovers a durable purchase and syncs metadata without buying again', async () => {
    const purchased = { ...SHIPMENT, status: 'purchased', shipmentId: 'ship-abc' };
    const store = makeStore({
      claim: null,
      row: { status: 'purchased', rate_id: 'rate-123', shipment_data: purchased },
    });
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: RATE }), { store });

    expect(label).toBe(purchased);
    expect(eship.createShipment).not.toHaveBeenCalled();
    expect(sdk.transactions.updateMetadata).toHaveBeenCalled();
  });

  it('does not re-buy when Sharetribe metadata failed after the durable purchase', async () => {
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const purchasedRow = {
      status: 'purchased',
      rate_id: 'rate-123',
      shipment_data: {
        status: 'purchased',
        shipmentId: 'ship-abc',
        labelUrl: 'https://eship/labels/abc.pdf',
      },
    };
    const store = makeStore({ row: purchasedRow });
    store.claim.mockResolvedValueOnce({ claim_token: 'claim-1' }).mockResolvedValueOnce(null);
    const firstSdk = makeSdk();
    firstSdk.transactions.updateMetadata.mockRejectedValue(new Error('Sharetribe unavailable'));

    const first = await buyLabelForTransaction(firstSdk, makeTx({ avShipping: RATE }), { store });
    const second = await buyLabelForTransaction(makeSdk(), makeTx({ avShipping: RATE }), { store });

    expect(first.status).toBe('purchased');
    expect(second).toBe(purchasedRow.shipment_data);
    expect(eship.createShipment).toHaveBeenCalledTimes(1);
  });

  it('records a definitive 4xx carrier rejection as failed', async () => {
    const error = Object.assign(new eship.EshipApiError(), {
      status: 422,
      message: 'rate expired',
    });
    eship.createShipment.mockRejectedValue(error);
    const store = makeStore();

    const label = await buyLabelForTransaction(makeSdk(), makeTx({ avShipping: RATE }), { store });

    expect(label).toMatchObject({ status: 'failed', rate_id: 'rate-123' });
    expect(store.finish).toHaveBeenCalledWith(
      'tx-1',
      'claim-1',
      expect.objectContaining({ status: 'failed' })
    );
  });

  it('records timeouts and malformed success responses as unknown', async () => {
    const timeout = new eship.EshipTimeoutError();
    timeout.message = 'timeout';
    eship.createShipment.mockRejectedValueOnce(timeout);
    const firstStore = makeStore();
    const timeoutLabel = await buyLabelForTransaction(makeSdk(), makeTx({ avShipping: RATE }), {
      store: firstStore,
    });

    eship.createShipment.mockResolvedValueOnce({ status: 'SUCCESS', object_id: 'ship-no-label' });
    const secondStore = makeStore();
    const malformedLabel = await buyLabelForTransaction(makeSdk(), makeTx({ avShipping: RATE }), {
      store: secondStore,
    });

    expect(timeoutLabel.status).toBe('unknown');
    expect(malformedLabel.status).toBe('unknown');
    expect(firstStore.finish).toHaveBeenCalledWith(
      'tx-1',
      'claim-1',
      expect.objectContaining({ status: 'unknown' })
    );
    expect(secondStore.finish).toHaveBeenCalledWith(
      'tx-1',
      'claim-1',
      expect.objectContaining({ status: 'unknown' })
    );
  });

  it('requires explicit unknown confirmation before retrying', async () => {
    const existing = { status: 'unknown', error: 'verify carrier' };

    const skipped = await buyLabelForTransaction(
      makeSdk(),
      makeTx({ avShipping: RATE, avLabel: existing }),
      { store: makeStore() }
    );
    expect(skipped).toBe(existing);
    expect(eship.createShipment).not.toHaveBeenCalled();

    eship.createShipment.mockResolvedValue(SHIPMENT);
    const store = makeStore();
    await buyLabelForTransaction(makeSdk(), makeTx({ avShipping: RATE, avLabel: existing }), {
      force: true,
      confirmUnknown: true,
      store,
    });
    expect(store.claim).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, confirmUnknown: true })
    );
    expect(eship.createShipment).toHaveBeenCalledTimes(1);
  });

  it('rejects an unpaid transaction before claiming or calling the carrier', async () => {
    const store = makeStore();
    const tx = makeTx({
      avShipping: RATE,
      lastTransition: 'transition/request-payment',
      transitions: [{ transition: 'transition/request-payment' }],
    });

    await expect(buyLabelForTransaction(makeSdk(), tx, { store })).rejects.toMatchObject({
      code: 'LABEL_NOT_ALLOWED',
    });
    expect(store.claim).not.toHaveBeenCalled();
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('returns null when no eShip rate exists', async () => {
    await expect(buyLabelForTransaction(makeSdk(), makeTx())).resolves.toBeNull();
    expect(createShippingLabelStore).not.toHaveBeenCalled();
  });
});

describe('shipping record authority (audit A01)', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('never buys for a paid pickup transaction carrying a forged rate', async () => {
    const store = makeStore();
    // Forged into protectedData by the buyer; the order only charges the item.
    const tx = makeTx({ legacyAvShipping: RATE, lineItems: [itemLine] });

    await expect(buyLabelForTransaction(makeSdk(), tx, { store })).rejects.toMatchObject({
      code: 'LABEL_NOT_ALLOWED',
      reason: 'SHIPPING_CHARGE_MISMATCH',
    });
    expect(store.claim).not.toHaveBeenCalled();
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('refuses a record whose price differs from the shipping charge', async () => {
    const store = makeStore();
    const tx = makeTx({
      avShipping: RATE,
      lineItems: [itemLine, shippingFeeLine({ ...RATE, amountSubunits: 100 })],
    });

    await expect(buyLabelForTransaction(makeSdk(), tx, { store })).rejects.toMatchObject({
      reason: 'SHIPPING_CHARGE_MISMATCH',
    });
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('buys with the metadata rate even when protectedData was rewritten after payment', async () => {
    const store = makeStore();
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const tx = makeTx({
      avShipping: RATE,
      legacyAvShipping: { ...RATE, rate_id: 'swapped-rate' },
      transitions: [
        { transition: 'transition/confirm-payment' },
        { transition: 'transition/mark-delivered' },
        { transition: 'transition/dispute' },
      ],
    });

    await buyLabelForTransaction(makeSdk(), tx, { store });
    expect(store.claim).toHaveBeenCalledWith(expect.objectContaining({ rateId: 'rate-123' }));
    expect(eship.createShipment).toHaveBeenCalledWith({ rateId: 'rate-123' });
  });

  it('accepts a legacy protectedData record only with a matching charge', async () => {
    const store = makeStore();
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const tx = makeTx({ legacyAvShipping: RATE });

    const label = await buyLabelForTransaction(makeSdk(), tx, { store });
    expect(label.status).toBe('purchased');
    expect(eship.createShipment).toHaveBeenCalledTimes(1);
  });

  it('refuses a legacy record once the customer could have rewritten it', async () => {
    const store = makeStore();
    const tx = makeTx({
      legacyAvShipping: RATE,
      transitions: [
        { transition: 'transition/confirm-payment' },
        { transition: 'transition/mark-delivered' },
        { transition: 'transition/dispute' },
      ],
    });

    await expect(buyLabelForTransaction(makeSdk(), tx, { store })).rejects.toMatchObject({
      reason: 'SHIPPING_RECORD_UNTRUSTED',
    });
    expect(store.claim).not.toHaveBeenCalled();
  });

  it('still returns an already purchased label without re-checking the record', async () => {
    const purchased = { status: 'purchased', labelUrl: 'https://l.pdf' };
    const tx = makeTx({ legacyAvShipping: RATE, avLabel: purchased, lineItems: [itemLine] });
    await expect(buyLabelForTransaction(makeSdk(), tx)).resolves.toBe(purchased);
  });

  it('reports where the trusted record came from', () => {
    expect(resolveLabelShippingRecord(makeTx({ avShipping: RATE })).source).toBe('metadata');
    expect(resolveLabelShippingRecord(makeTx({ legacyAvShipping: RATE })).source).toBe('legacy');
    expect(resolveLabelShippingRecord(makeTx()).record).toBeNull();
  });
});

describe('validateShipment', () => {
  it('requires SUCCESS, an id, and a label URL', () => {
    expect(validateShipment(SHIPMENT)).toBe('ship-abc');
    expect(() => validateShipment({ status: 'ERROR', object_id: 'x', label_url: 'x' })).toThrow(
      'incomplete'
    );
    expect(() => validateShipment({ status: 'SUCCESS', object_id: 'x' })).toThrow('incomplete');
  });
});

describe('maybeBuyLabelForEvent', () => {
  const ORIGINAL_AUTOBUY = process.env.ESHIP_LABEL_AUTOBUY;
  afterEach(() => {
    if (ORIGINAL_AUTOBUY === undefined) delete process.env.ESHIP_LABEL_AUTOBUY;
    else process.env.ESHIP_LABEL_AUTOBUY = ORIGINAL_AUTOBUY;
  });

  const resource = lastTransition => ({
    id: { uuid: 'tx-1' },
    attributes: { lastTransition },
  });

  it('is disabled independently of notification delivery', async () => {
    process.env.ESHIP_LABEL_AUTOBUY = 'true';
    isShippingLabelsEnabled.mockReturnValue(false);
    const sdk = { transactions: { show: jest.fn() } };

    await expect(
      maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'))
    ).resolves.toBeNull();
    expect(sdk.transactions.show).not.toHaveBeenCalled();
  });

  it('does NOT auto-buy when ESHIP_LABEL_AUTOBUY is unset (manual button only)', async () => {
    delete process.env.ESHIP_LABEL_AUTOBUY;
    const sdk = { transactions: { show: jest.fn() } };

    await expect(
      maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'))
    ).resolves.toBeNull();
    expect(sdk.transactions.show).not.toHaveBeenCalled();
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('does NOT auto-buy when ESHIP_LABEL_AUTOBUY is "false"', async () => {
    process.env.ESHIP_LABEL_AUTOBUY = 'false';
    const sdk = { transactions: { show: jest.fn() } };

    await expect(
      maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'))
    ).resolves.toBeNull();
    expect(sdk.transactions.show).not.toHaveBeenCalled();
  });

  it('auto-buys on confirm-payment when labels are enabled AND ESHIP_LABEL_AUTOBUY is "true"', async () => {
    process.env.ESHIP_LABEL_AUTOBUY = 'true';
    const store = makeStore();
    createShippingLabelStore.mockReturnValue(store);
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const tx = makeTx({ avShipping: RATE });
    const sdk = {
      transactions: {
        show: jest.fn().mockResolvedValue({ data: { data: tx } }),
        updateMetadata: jest.fn().mockResolvedValue({}),
      },
    };

    const label = await maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'));

    expect(label.status).toBe('purchased');
    expect(sdk.transactions.show).toHaveBeenCalled();
  });
});
