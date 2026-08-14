'use strict';

jest.mock('./notificationConfig', () => ({
  isEshipTrackingEmailsEnabled: jest.fn(() => true),
}));

const {
  PICKED_UP_TRANSITIONS,
  executePickedUpTransition,
  isVerifiedPickedUp,
  processClaim,
  retryDelaySeconds,
  safeTrackingUrl,
  verifiedTrackingData,
} = require('./eshipTrackingService');

const claim = {
  id: 9,
  shipment_id: 'ship-9',
  webhook_tracking_number: 'TRACK-9',
  event_at: '2026-08-14T18:00:00.000Z',
  claim_token: 'claim-9',
  attempt_count: 1,
};

const shipment = {
  object_id: 'ship-9',
  provider: 'FedEx',
  tracking_number: 'TRACK-9',
  tracking_url_provider: 'https://fedex.example/track/TRACK-9',
  tracking: { status: 'TRANSIT', substatus: 'picked_up' },
};

const transaction = ({
  state = 'state/purchased',
  processName = 'default-purchase',
  metadata = {},
  transitions = [],
} = {}) => ({
  id: { uuid: 'tx-9' },
  attributes: { state, processName, metadata, transitions },
});

const makeStore = () => ({
  findTransactionByShipmentId: jest.fn().mockResolvedValue('tx-9'),
  markFailed: jest.fn().mockResolvedValue(),
  markIgnored: jest.fn().mockResolvedValue(),
  markSent: jest.fn().mockResolvedValue(),
});

describe('eShip tracking verification', () => {
  test('accepts picked_up from current tracking or event history', () => {
    expect(isVerifiedPickedUp(shipment)).toBe(true);
    expect(
      isVerifiedPickedUp({
        tracking: { status: 'TRANSIT', substatus: 'in_transit' },
        events: [{ status: 'TRANSIT', substatus: 'picked_up' }],
      })
    ).toBe(true);
    expect(
      isVerifiedPickedUp({ tracking: { status: 'UNKNOWN', substatus: 'label_created' } })
    ).toBe(false);
  });

  test('prefers a valid provider link and falls back to eShip custom tracking', () => {
    expect(verifiedTrackingData(shipment, claim)).toMatchObject({
      shipmentId: 'ship-9',
      providerName: 'FedEx',
      trackingUrl: 'https://fedex.example/track/TRACK-9',
      status: 'TRANSIT',
      substatus: 'picked_up',
    });
    expect(
      verifiedTrackingData(
        {
          ...shipment,
          tracking_url_provider: 'javascript:alert(1)',
          tracking_url_custom: 'https://track.myeship.co/track?no=TRACK-9',
        },
        claim
      ).trackingUrl
    ).toBe('https://track.myeship.co/track?no=TRACK-9');
    expect(safeTrackingUrl('javascript:alert(1)')).toBeNull();
  });

  test('rejects webhook and authenticated shipment mismatches', () => {
    expect(() => verifiedTrackingData({ ...shipment, tracking_number: 'OTHER' }, claim)).toThrow(
      'different tracking number'
    );
  });

  test('uses bounded exponential retry delays', () => {
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(2)).toBe(60);
    expect(retryDelaySeconds(99)).toBe(3600);
  });
});

describe('eShip Sharetribe notification processing', () => {
  test('updates metadata before executing the purchased self-transition', async () => {
    const store = makeStore();
    const tx = transaction();
    const sdk = {
      transactions: {
        show: jest
          .fn()
          .mockResolvedValueOnce({ data: { data: tx } })
          .mockResolvedValueOnce({ data: { data: tx } }),
        updateMetadata: jest.fn().mockResolvedValue({}),
        transition: jest.fn().mockResolvedValue({}),
      },
    };

    await expect(
      processClaim({ claim, store, sdk, fetchShipment: jest.fn().mockResolvedValue(shipment) })
    ).resolves.toMatchObject({ status: 'sent' });

    expect(sdk.transactions.updateMetadata).toHaveBeenCalledWith({
      id: 'tx-9',
      metadata: { avTracking: expect.objectContaining({ shipmentId: 'ship-9' }) },
    });
    expect(sdk.transactions.transition).toHaveBeenCalledWith({
      id: 'tx-9',
      transition: PICKED_UP_TRANSITIONS.purchased,
      params: {},
    });
    expect(store.markSent).toHaveBeenCalledWith(9, 'claim-9', 'tx-9');
  });

  test('reconciles a previously accepted transition without sending twice', async () => {
    const store = makeStore();
    const tx = transaction({
      metadata: { avTracking: { shipmentId: 'ship-9' } },
      transitions: [{ transition: PICKED_UP_TRANSITIONS.purchased }],
    });
    const sdk = {
      transactions: {
        show: jest.fn().mockResolvedValue({ data: { data: tx } }),
        updateMetadata: jest.fn(),
        transition: jest.fn(),
      },
    };

    await processClaim({
      claim,
      store,
      sdk,
      fetchShipment: jest.fn().mockResolvedValue(shipment),
    });

    expect(store.markSent).toHaveBeenCalled();
    expect(sdk.transactions.updateMetadata).not.toHaveBeenCalled();
    expect(sdk.transactions.transition).not.toHaveBeenCalled();
  });

  test('switches to the delivered self-transition when the state races', async () => {
    const purchased = transaction();
    const delivered = transaction({ state: 'state/delivered' });
    const invalidTransition = Object.assign(new Error('invalid transition'), {
      status: 409,
      data: { errors: [{ code: 'transaction-invalid-transition' }] },
    });
    const sdk = {
      transactions: {
        show: jest
          .fn()
          .mockResolvedValueOnce({ data: { data: purchased } })
          .mockResolvedValueOnce({ data: { data: purchased } })
          .mockResolvedValueOnce({ data: { data: delivered } }),
        updateMetadata: jest.fn().mockResolvedValue({}),
        transition: jest
          .fn()
          .mockRejectedValueOnce(invalidTransition)
          .mockResolvedValueOnce({}),
      },
    };

    const result = await processClaim({
      claim,
      store: makeStore(),
      sdk,
      fetchShipment: jest.fn().mockResolvedValue(shipment),
    });

    expect(result).toMatchObject({
      status: 'sent',
      transition: PICKED_UP_TRANSITIONS.delivered,
    });
  });

  test('ignores completed transactions without updating metadata or transitioning', async () => {
    const store = makeStore();
    const tx = transaction({ state: 'state/completed' });
    const sdk = {
      transactions: {
        show: jest.fn().mockResolvedValue({ data: { data: tx } }),
        updateMetadata: jest.fn(),
        transition: jest.fn(),
      },
    };

    await processClaim({
      claim,
      store,
      sdk,
      fetchShipment: jest.fn().mockResolvedValue(shipment),
    });

    expect(store.markIgnored).toHaveBeenCalledWith(
      9,
      'claim-9',
      expect.objectContaining({ reason: 'transaction_state_completed_not_eligible' })
    );
    expect(sdk.transactions.updateMetadata).not.toHaveBeenCalled();
  });

  test('records transient verification failures for retry', async () => {
    const store = makeStore();
    const sdk = { transactions: { show: jest.fn() } };

    const result = await processClaim({
      claim,
      store,
      sdk,
      fetchShipment: jest.fn().mockRejectedValue(new Error('eShip unavailable')),
    });

    expect(result.status).toBe('failed');
    expect(store.markFailed).toHaveBeenCalledWith(
      9,
      'claim-9',
      expect.objectContaining({
        transactionId: 'tx-9',
        error: 'eShip unavailable',
        retryDelaySeconds: 30,
      })
    );
  });

  test('re-reads once after an invalid transition', async () => {
    const invalidTransition = Object.assign(new Error('invalid transition'), {
      status: 409,
      data: { errors: [{ code: 'transaction-invalid-transition' }] },
    });
    const tx = transaction();
    const sdk = {
      transactions: {
        show: jest.fn().mockResolvedValue({ data: { data: tx } }),
        transition: jest.fn().mockRejectedValue(invalidTransition),
      },
    };

    await expect(executePickedUpTransition(sdk, tx)).resolves.toEqual({
      ignored: 'eship_picked_up_transition_unavailable_for_process_version',
    });
  });
});
