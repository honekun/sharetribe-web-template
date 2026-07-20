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
  validateShipment,
} = require('./shipmentService');

const makeSdk = () => ({
  transactions: { updateMetadata: jest.fn().mockResolvedValue({}) },
});

const makeTx = ({
  avShipping,
  avLabel,
  lastTransition = 'transition/confirm-payment',
  transitions = [{ transition: 'transition/confirm-payment' }],
} = {}) => ({
  id: { uuid: 'tx-1' },
  attributes: {
    protectedData: avShipping ? { avShipping } : {},
    metadata: avLabel ? { avLabel } : {},
    lastTransition,
    transitions,
  },
});

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
  const resource = lastTransition => ({
    id: { uuid: 'tx-1' },
    attributes: { lastTransition },
  });

  it('is disabled independently of notification delivery', async () => {
    isShippingLabelsEnabled.mockReturnValue(false);
    const sdk = { transactions: { show: jest.fn() } };

    await expect(
      maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'))
    ).resolves.toBeNull();
    expect(sdk.transactions.show).not.toHaveBeenCalled();
  });

  it('loads and buys on confirm-payment when shipping labels are enabled', async () => {
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
