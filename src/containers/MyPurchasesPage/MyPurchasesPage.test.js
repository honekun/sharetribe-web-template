import React from 'react';
import '@testing-library/jest-dom';
import Decimal from 'decimal.js';

import { types as sdkTypes } from '../../util/sdkLoader';
import { LINE_ITEM_ITEM, LINE_ITEM_PROVIDER_COMMISSION } from '../../util/types';
import {
  createUser,
  createCurrentUser,
  createListing,
  createTransaction,
} from '../../util/testData';
import { renderWithProviders as render, testingLibrary } from '../../util/testHelpers';
import { getProcess } from '../../transactions/transaction';

import MyPurchasesPage from './MyPurchasesPage';
import reducer, { loadDataThunk } from './MyPurchasesPage.duck';

const { Money } = sdkTypes;
const { screen, waitFor } = testingLibrary;
const noop = () => null;

const purchaseTransitions = getProcess('default-purchase')?.transitions;

describe('MyPurchasesPage', () => {
  const provider = createUser('provider');
  const customer = createUser('customer');
  const currentUser = createCurrentUser('customer-user-id');
  const listing = createListing('listing1', {
    publicData: {
      listingType: 'sell-bikes',
      transactionProcessAlias: 'default-purchase',
      unitType: 'item',
    },
  });

  const lineItems = [
    {
      code: LINE_ITEM_ITEM,
      includeFor: ['customer', 'provider'],
      quantity: new Decimal(1),
      unitPrice: new Money(1000, 'USD'),
      lineTotal: new Money(1000, 'USD'),
      reversal: false,
    },
    {
      code: LINE_ITEM_PROVIDER_COMMISSION,
      includeFor: ['provider'],
      unitPrice: new Money(-100, 'USD'),
      lineTotal: new Money(-100, 'USD'),
      reversal: false,
    },
  ];

  const baseState = {
    MyPurchasesPage: {
      fetchInProgress: false,
      fetchOrdersError: null,
      pagination: null,
      transactionRefs: [],
    },
    marketplaceData: { entities: {} },
    user: {
      currentUser,
      currentUserHasListings: false,
      sendVerificationEmailInProgress: false,
    },
  };

  it('renders page heading', async () => {
    render(<MyPurchasesPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('MyPurchasesPage.heading')).toBeInTheDocument();
    });
  });

  it('renders empty state', async () => {
    render(<MyPurchasesPage />, { initialState: baseState });

    await waitFor(() => {
      expect(screen.getByText('MyPurchasesPage.noResults')).toBeInTheDocument();
    });
  });

  it('renders transaction list', async () => {
    const order1 = createTransaction({
      id: 'order1',
      lastTransition: purchaseTransitions.CONFIRM_PAYMENT,
      customer,
      provider,
      listing,
      lastTransitionedAt: new Date(Date.UTC(2023, 0, 15)),
      lineItems,
    });

    const initialState = {
      ...baseState,
      MyPurchasesPage: {
        fetchInProgress: false,
        fetchOrdersError: null,
        pagination: { page: 1, perPage: 10, totalItems: 1, totalPages: 1 },
        transactionRefs: [{ id: order1.id, type: order1.type }],
      },
      marketplaceData: {
        entities: {
          transaction: { order1 },
          user: { customer, provider },
          listing: { listing1: listing },
        },
      },
    };

    render(<MyPurchasesPage />, { initialState });

    await waitFor(() => {
      const items = screen.queryAllByRole('link', { name: /listing1/i });
      expect(items).toHaveLength(1);
    });
  });

  it('renders loading spinner', async () => {
    const initialState = {
      ...baseState,
      MyPurchasesPage: {
        ...baseState.MyPurchasesPage,
        fetchInProgress: true,
      },
    };

    const { container } = render(<MyPurchasesPage />, { initialState });

    await waitFor(() => {
      const spinner = container.querySelector('svg');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('renders error state', async () => {
    const initialState = {
      ...baseState,
      MyPurchasesPage: {
        ...baseState.MyPurchasesPage,
        fetchOrdersError: { type: 'error', name: 'test', message: 'test error' },
      },
    };

    render(<MyPurchasesPage />, { initialState });

    await waitFor(() => {
      expect(screen.getByText('MyPurchasesPage.loadingError')).toBeInTheDocument();
    });
  });

  it('renders pagination', async () => {
    const order1 = createTransaction({
      id: 'order1',
      lastTransition: purchaseTransitions.CONFIRM_PAYMENT,
      customer,
      provider,
      listing,
      lastTransitionedAt: new Date(Date.UTC(2023, 0, 15)),
      lineItems,
    });

    const initialState = {
      ...baseState,
      MyPurchasesPage: {
        fetchInProgress: false,
        fetchOrdersError: null,
        pagination: { page: 1, perPage: 10, totalItems: 25, totalPages: 3 },
        transactionRefs: [{ id: order1.id, type: order1.type }],
      },
      marketplaceData: {
        entities: {
          transaction: { order1 },
          user: { customer, provider },
          listing: { listing1: listing },
        },
      },
    };

    render(<MyPurchasesPage />, { initialState });

    await waitFor(() => {
      // PaginationLinks renders a <nav>, plus topbar and UserNav are also navs
      const navs = screen.getAllByRole('navigation');
      expect(navs.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('MyPurchasesPage reducer', () => {
  it('returns initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({
      fetchInProgress: false,
      fetchOrdersError: null,
      pagination: null,
      transactionRefs: [],
    });
  });

  it('handles pending state', () => {
    const state = reducer(undefined, { type: loadDataThunk.pending.type });
    expect(state.fetchInProgress).toBe(true);
    expect(state.fetchOrdersError).toBeNull();
  });

  it('handles fulfilled state', () => {
    const action = {
      type: loadDataThunk.fulfilled.type,
      payload: {
        data: {
          data: [{ id: { uuid: 'tx1' }, type: 'transaction' }],
          meta: { page: 1, totalPages: 1, totalItems: 1, perPage: 10 },
        },
      },
    };
    const state = reducer(undefined, action);
    expect(state.fetchInProgress).toBe(false);
    expect(state.transactionRefs).toHaveLength(1);
    expect(state.pagination).toEqual(action.payload.data.meta);
  });

  it('handles rejected state', () => {
    const error = { type: 'error', name: 'test', message: 'fail' };
    const state = reducer(undefined, {
      type: loadDataThunk.rejected.type,
      payload: error,
    });
    expect(state.fetchInProgress).toBe(false);
    expect(state.fetchOrdersError).toEqual(error);
  });
});
