const { types } = require('sharetribe-flex-sdk');
const { Money } = types;

// Shipping fees now come from the live eShip quote service. Mock it so these
// unit tests stay offline and deterministic.
jest.mock('../services/shippingQuoteService');
const quoteSvc = require('../services/shippingQuoteService');
const { transactionLineItems } = require('./lineItems');

describe('transactionLineItems', () => {
  // Mock data for testing
  const mockListing = {
    attributes: {
      price: new Money(10000, 'EUR'), // €100.00
      publicData: {
        unitType: 'day',
        priceVariationsEnabled: false,
      },
    },
  };

  const mockProviderCommission = {
    percentage: 10,
    minimum_amount: 500, // €5.00
  };

  const mockCustomerCommission = {
    percentage: 5,
    minimum_amount: 200, // €2.00
  };

  beforeEach(() => {
    quoteSvc.resolveBucketPrice.mockReset();
  });

  describe('Default Booking Process - Day Unit Type', () => {
    it('should create line items for day-based booking without seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3); // order + provider commission + customer commission

      expect(result[0]).toEqual({
        code: 'line-item/day',
        unitPrice: new Money(10000, 'EUR'),
        quantity: 2, // 2 days between dates
        includeFor: ['customer', 'provider'],
      });

      expect(result[1].code).toBe('line-item/provider-commission');
      expect(result[1].includeFor).toEqual(['provider']);

      expect(result[2].code).toBe('line-item/customer-commission');
      expect(result[2].includeFor).toEqual(['customer']);
    });

    it('should create line items for day-based booking with seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
        seats: 3,
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/day',
        unitPrice: new Money(10000, 'EUR'),
        units: 2, // 2 days
        seats: 3, // 3 seats
        includeFor: ['customer', 'provider'],
      });
    });
  });

  describe('Default Booking Process - Night Unit Type', () => {
    it('should create line items for night-based booking without seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'night' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/night',
        unitPrice: new Money(10000, 'EUR'),
        quantity: 2, // 2 nights between dates
        includeFor: ['customer', 'provider'],
      });
    });

    it('should create line items for night-based booking with seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'night' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
        seats: 4,
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/night',
        unitPrice: new Money(10000, 'EUR'),
        units: 2, // 2 nights
        seats: 4, // 4 seats
        includeFor: ['customer', 'provider'],
      });
    });
  });

  describe('Default Booking Process - Hour Unit Type', () => {
    it('should create line items for hour-based booking without seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'hour' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-01T03:00:00.000Z', // 3 hours
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/hour',
        unitPrice: new Money(10000, 'EUR'),
        quantity: 3, // 3 hours
        includeFor: ['customer', 'provider'],
      });
    });

    it('should create line items for hour-based booking with seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'hour' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-01T03:00:00.000Z', // 3 hours
        seats: 2,
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/hour',
        unitPrice: new Money(10000, 'EUR'),
        units: 3, // 3 hours
        seats: 2, // 2 seats
        includeFor: ['customer', 'provider'],
      });
    });
  });

  describe('Default Booking Process - Fixed Unit Type', () => {
    it('should create line items for fixed-duration booking without seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'fixed' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-01T02:00:00.000Z',
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/fixed',
        unitPrice: new Money(10000, 'EUR'),
        quantity: 1, // 1 fixed session
        includeFor: ['customer', 'provider'],
      });
    });

    it('should create line items for fixed-duration booking with seats', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'fixed' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-01T02:00:00.000Z',
        seats: 5,
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/fixed',
        unitPrice: new Money(10000, 'EUR'),
        units: 1, // 1 fixed session
        seats: 5, // 5 seats
        includeFor: ['customer', 'provider'],
      });
    });
  });

  describe('Default Purchase Process - Item Unit Type', () => {
    const itemListing = {
      ...mockListing,
      attributes: {
        ...mockListing.attributes,
        publicData: { ...mockListing.attributes.publicData, unitType: 'item' },
      },
    };

    it('should create line items for item purchase with pickup delivery', async () => {
      const orderData = {
        stockReservationQuantity: 2,
        deliveryMethod: 'pickup',
        currency: 'EUR',
      };

      const result = await transactionLineItems(
        itemListing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3); // order + provider + customer (no shipping for pickup)
      expect(result[0]).toEqual({
        code: 'line-item/item',
        unitPrice: new Money(10000, 'EUR'),
        quantity: 2,
        includeFor: ['customer', 'provider'],
      });
      expect(quoteSvc.resolveBucketPrice).not.toHaveBeenCalled();
    });

    it('adds a shipping-fee line item from the resolved quote', async () => {
      quoteSvc.resolveBucketPrice.mockResolvedValue({ amountSubunits: 11800, currency: 'EUR' });
      const orderData = {
        stockReservationQuantity: 3,
        deliveryMethod: 'shipping',
        avShippingType: 'nacionalExpress',
        avQuoteToken: 't',
        avDestination: { zip: '64000' },
        currency: 'EUR',
      };

      const result = await transactionLineItems(
        itemListing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(4); // order + shipping + provider + customer
      expect(result[0].code).toBe('line-item/item');
      expect(result[1]).toEqual({
        code: 'line-item/shipping-fee',
        unitPrice: new Money(11800, 'EUR'),
        quantity: 1,
        // AV: shipping is retained by the platform (AV buys the eShip label
        // centrally), so it is NOT paid out to the provider. See eship-integration.md.
        includeFor: ['customer'],
      });
    });

    it('does not attempt to quote on the initial speculate (no delivery type chosen yet)', async () => {
      // On checkout load the tx is speculated with deliveryMethod 'shipping' but no
      // avShippingType / token / destination. We must NOT call the quote service then
      // (it would hit eShip with no address and fail the whole speculation).
      const orderData = {
        stockReservationQuantity: 1,
        deliveryMethod: 'shipping',
        currency: 'EUR',
      };
      const result = await transactionLineItems(itemListing, orderData, null, null);
      expect(quoteSvc.resolveBucketPrice).not.toHaveBeenCalled();
      expect(result.find(li => li.code === 'line-item/shipping-fee')).toBeUndefined();
    });

    it('omits the shipping-fee line item when no price resolves (especial/unquotable)', async () => {
      quoteSvc.resolveBucketPrice.mockResolvedValue(null);
      const orderData = {
        stockReservationQuantity: 1,
        deliveryMethod: 'shipping',
        avShippingType: 'nacionalExpress',
        currency: 'EUR',
      };

      const result = await transactionLineItems(itemListing, orderData, null, null);

      expect(result.find(li => li.code === 'line-item/shipping-fee')).toBeUndefined();
    });
  });

  describe('Default Negotiation Process - Request Unit Type (Reverse Flow)', () => {
    it('should create line items for negotiation request with offer', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'request' },
        },
      };

      const orderData = {
        offer: new Money(15000, 'EUR'), // €150.00 offer
        currency: 'EUR',
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3); // order + provider + customer

      expect(result[0]).toEqual({
        code: 'line-item/request',
        unitPrice: new Money(15000, 'EUR'), // Uses the offer amount
        quantity: 1,
        includeFor: ['customer', 'provider'],
      });
    });

    it('should create line items for negotiation request without offer (uses listing price)', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'request' },
        },
      };

      const orderData = { currency: 'EUR' };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({
        code: 'line-item/request',
        unitPrice: new Money(10000, 'EUR'), // Uses listing price
        quantity: 1,
        includeFor: ['customer', 'provider'],
      });
    });
  });

  describe('Price Variants', () => {
    it('should use price variant when priceVariationsEnabled is true', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: {
            ...mockListing.attributes.publicData,
            unitType: 'day',
            priceVariationsEnabled: true,
            priceVariants: [{ name: 'weekend', priceInSubunits: 15000 }],
          },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
        priceVariantName: 'weekend',
      };

      const result = await transactionLineItems(
        listing,
        orderData,
        mockProviderCommission,
        mockCustomerCommission
      );

      expect(result[0].unitPrice).toEqual(new Money(15000, 'EUR'));
    });
  });

  describe('Commission Handling', () => {
    it('should not add commission line items when commissions are not provided', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
      };

      const result = await transactionLineItems(listing, orderData, null, null);

      expect(result).toHaveLength(1); // Only order line item
      expect(result[0].code).toBe('line-item/day');
    });

    it('should use minimum commission when it is greater than percentage-based commission', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
      };

      const providerCommission = { percentage: 5, minimum_amount: 3000 };

      const result = await transactionLineItems(listing, orderData, providerCommission, null);

      expect(result).toHaveLength(2); // order + provider commission
      expect(result[1].code).toBe('line-item/provider-commission');
      expect(result[1].unitPrice).toEqual(new Money(3000, 'EUR')); // Uses minimum amount
      expect(result[1].quantity).toBe(-1); // Negative for provider commission
    });

    it('should use percentage-based commission when it is greater than minimum', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
      };

      const providerCommission = { percentage: 15, minimum_amount: 100 };

      const result = await transactionLineItems(listing, orderData, providerCommission, null);

      expect(result).toHaveLength(2); // order + provider commission
      expect(result[1].code).toBe('line-item/provider-commission');
      expect(result[1].percentage).toBe(-15); // Negative percentage for provider commission
    });
  });

  describe('Error Handling', () => {
    it('should throw error when orderData is missing required quantity information', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {}; // Missing bookingStart and bookingEnd

      await expect(
        transactionLineItems(listing, orderData, mockProviderCommission, mockCustomerCommission)
      ).rejects.toThrow(
        'Error: orderData is missing the following information: quantity, units, seats. Quantity or either units & seats is required.'
      );
    });

    it('should throw error when orderData is missing units and seats for seat-based booking', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = { seats: 2 };

      await expect(
        transactionLineItems(listing, orderData, mockProviderCommission, mockCustomerCommission)
      ).rejects.toThrow(
        'Error: orderData is missing the following information: quantity, units. Quantity or either units & seats is required.'
      );
    });

    it('should throw error when minimum commission is greater than transaction amount', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          ...mockListing.attributes,
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
      };

      const providerCommission = { percentage: 5, minimum_amount: 50000 };

      await expect(
        transactionLineItems(listing, orderData, providerCommission, null)
      ).rejects.toThrow('Minimum commission amount is greater than the amount of money paid in');
    });
  });

  describe('Currency Handling', () => {
    it('should use currency from orderData when listing price has no currency', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          price: null, // No price attribute
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
        currency: 'USD',
      };

      const result = await transactionLineItems(listing, orderData, null, null);

      expect(result[0].unitPrice).toBeNull(); // No unit price when no listing price
    });

    it('should use currency from listing price when available', async () => {
      const listing = {
        ...mockListing,
        attributes: {
          price: new Money(10000, 'USD'), // USD currency
          publicData: { ...mockListing.attributes.publicData, unitType: 'day' },
        },
      };

      const orderData = {
        bookingStart: '2024-01-01T00:00:00.000Z',
        bookingEnd: '2024-01-03T00:00:00.000Z',
        currency: 'EUR', // Different currency in orderData
      };

      const result = await transactionLineItems(listing, orderData, null, null);

      expect(result[0].unitPrice.currency).toBe('USD'); // Uses listing currency
    });
  });
});
