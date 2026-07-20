'use strict';

jest.mock('../api-util/eshipClient');
const eship = require('../api-util/eshipClient');
const { buyLabelForTransaction, maybeBuyLabelForEvent } = require('./shipmentService');

// Fake Integration SDK with a spyable updateMetadata.
const makeSdk = () => ({
  transactions: { updateMetadata: jest.fn().mockResolvedValue({}) },
});

// Transaction fixture. `avShipping` is the rate persisted at initiate; `avLabel`
// (when present) is the metadata marker written by a prior label attempt.
const makeTx = ({ avShipping, avLabel } = {}) => ({
  id: { uuid: 'tx-1' },
  attributes: {
    protectedData: avShipping ? { avShipping } : {},
    metadata: avLabel ? { avLabel } : {},
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
  shipment_id: 'ship-abc',
  tracking_number: 'TRK-777',
  label_url: 'https://eship/labels/abc.pdf',
};

beforeEach(() => {
  eship.createShipment.mockReset();
  eship.describeEshipError.mockReset();
  eship.describeEshipError.mockImplementation(e => `EshipApiError: ${e.message}`);
});

describe('buyLabelForTransaction', () => {
  it('buys a label and persists a purchased marker when a rate is present and none bought yet', async () => {
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: RATE }));

    expect(eship.createShipment).toHaveBeenCalledWith({ rateId: 'rate-123', quotId: 'quot-9' });
    expect(label).toMatchObject({
      status: 'purchased',
      shipmentId: 'ship-abc',
      trackingNumber: 'TRK-777',
      labelUrl: 'https://eship/labels/abc.pdf',
      carrier: 'Estafeta',
      servicelevel: 'Express',
    });
    expect(label.purchasedAt).toEqual(expect.any(String));
    expect(sdk.transactions.updateMetadata).toHaveBeenCalledWith({
      id: { uuid: 'tx-1' },
      metadata: { avLabel: label },
    });
  });

  it('is idempotent: returns the existing label without re-buying when already purchased', async () => {
    const existing = { status: 'purchased', shipmentId: 'ship-abc', labelUrl: 'https://x/y.pdf' };
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(
      sdk,
      makeTx({ avShipping: RATE, avLabel: existing })
    );

    expect(label).toBe(existing);
    expect(eship.createShipment).not.toHaveBeenCalled();
    expect(sdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  it('skips a previously-failed label on the auto path (force omitted)', async () => {
    const failed = { status: 'failed', error: 'carrier down', rate_id: 'rate-123' };
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: RATE, avLabel: failed }));

    expect(label).toBe(failed);
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('retries a previously-failed label when force is true', async () => {
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const failed = { status: 'failed', error: 'carrier down', rate_id: 'rate-123' };
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: RATE, avLabel: failed }), {
      force: true,
    });

    expect(eship.createShipment).toHaveBeenCalledTimes(1);
    expect(label.status).toBe('purchased');
  });

  it('returns null and buys nothing when there is no rate to buy (especial / Contactar AV)', async () => {
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: undefined }));

    expect(label).toBeNull();
    expect(eship.createShipment).not.toHaveBeenCalled();
    expect(sdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  it('writes a failed marker (and does not throw) when the carrier errors', async () => {
    eship.createShipment.mockRejectedValue(new Error('rate expired'));
    const sdk = makeSdk();

    const label = await buyLabelForTransaction(sdk, makeTx({ avShipping: RATE }));

    expect(label).toMatchObject({
      status: 'failed',
      error: 'EshipApiError: rate expired',
      rate_id: 'rate-123',
    });
    expect(label.failedAt).toEqual(expect.any(String));
    expect(sdk.transactions.updateMetadata).toHaveBeenCalledWith({
      id: { uuid: 'tx-1' },
      metadata: { avLabel: label },
    });
  });
});

describe('maybeBuyLabelForEvent', () => {
  // Integration SDK that also serves the full transaction back via .show().
  const makeEventSdk = fullTx => ({
    transactions: {
      show: jest.fn().mockResolvedValue({ data: { data: fullTx } }),
      updateMetadata: jest.fn().mockResolvedValue({}),
    },
  });
  const resource = (lastTransition, id = { uuid: 'tx-1' }) => ({
    id,
    attributes: { lastTransition },
  });

  it('buys a label on confirm-payment: fetches the full tx and delegates (force=false)', async () => {
    eship.createShipment.mockResolvedValue(SHIPMENT);
    const sdk = makeEventSdk(makeTx({ avShipping: RATE }));

    const label = await maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'));

    expect(sdk.transactions.show).toHaveBeenCalledWith({ id: { uuid: 'tx-1' } });
    expect(label.status).toBe('purchased');
    expect(sdk.transactions.updateMetadata).toHaveBeenCalled();
  });

  it('ignores transitions other than confirm-payment (no fetch, no buy)', async () => {
    const sdk = makeEventSdk(makeTx({ avShipping: RATE }));

    const label = await maybeBuyLabelForEvent(sdk, resource('transition/mark-delivered'));

    expect(label).toBeNull();
    expect(sdk.transactions.show).not.toHaveBeenCalled();
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('respects the idempotency marker on replay (already purchased → no re-buy)', async () => {
    const existing = { status: 'purchased', labelUrl: 'https://x/y.pdf' };
    const sdk = makeEventSdk(makeTx({ avShipping: RATE, avLabel: existing }));

    const label = await maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'));

    expect(label).toBe(existing);
    expect(eship.createShipment).not.toHaveBeenCalled();
  });

  it('swallows infra errors (SDK show rejects) and returns null without throwing', async () => {
    const sdk = {
      transactions: {
        show: jest.fn().mockRejectedValue(new Error('502 from marketplace API')),
        updateMetadata: jest.fn(),
      },
    };

    await expect(
      maybeBuyLabelForEvent(sdk, resource('transition/confirm-payment'))
    ).resolves.toBeNull();
  });
});
