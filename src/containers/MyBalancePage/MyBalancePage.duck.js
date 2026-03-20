import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { storableError } from '../../util/errors';
import { parse } from '../../util/urlHelpers';
import { getSupportedProcessesInfo, INQUIRY_PROCESS_NAME } from '../../transactions/transaction';
import {
  buildFilteredQueryParams,
  getCompletedTransitions,
  getRefundedTransitions,
} from '../../transactions/transactionHelpers';
import { addMarketplaceEntities } from '../../ducks/marketplaceData.duck';

const PAGE_SIZE = 10;
const SUMMARY_PER_PAGE = 100;

const entityRefs = entities =>
  entities.map(entity => ({
    id: entity.id,
    type: entity.type,
  }));

const paymentProcessNames = () =>
  getSupportedProcessesInfo()
    .filter(p => p.name !== INQUIRY_PROCESS_NAME)
    .map(p => p.name);

const myBalancePageSlice = createSlice({
  name: 'MyBalancePage',
  initialState: {
    fetchInProgress: false,
    fetchError: null,
    pagination: null,
    transactionRefs: [],
    summaryFetchInProgress: false,
    completedTotalAmount: 0,
    pendingTotalAmount: 0,
    cancelledCount: 0,
    currentMonthCompletedAmount: 0,
    currentMonthPendingAmount: 0,
    currentMonthCancelledCount: 0,
    currency: null,
  },
  reducers: {},
  extraReducers: builder => {
    builder
      // Main transaction list
      .addCase(loadTransactionsThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(loadTransactionsThunk.fulfilled, (state, action) => {
        const transactions = action.payload.data.data;
        state.fetchInProgress = false;
        state.transactionRefs = entityRefs(transactions);
        state.pagination = action.payload.data.meta;
      })
      .addCase(loadTransactionsThunk.rejected, (state, action) => {
        console.error(action.payload || action.error); // eslint-disable-line
        state.fetchInProgress = false;
        state.fetchError = action.payload;
      })
      // Summary totals
      .addCase(fetchSummaryThunk.pending, state => {
        state.summaryFetchInProgress = true;
      })
      .addCase(fetchSummaryThunk.fulfilled, (state, action) => {
        const {
          completedTotalAmount,
          pendingTotalAmount,
          cancelledCount,
          currentMonthCompletedAmount,
          currentMonthPendingAmount,
          currentMonthCancelledCount,
          currency,
        } = action.payload;
        state.summaryFetchInProgress = false;
        state.completedTotalAmount = completedTotalAmount;
        state.pendingTotalAmount = pendingTotalAmount;
        state.cancelledCount = cancelledCount;
        state.currentMonthCompletedAmount = currentMonthCompletedAmount;
        state.currentMonthPendingAmount = currentMonthPendingAmount;
        state.currentMonthCancelledCount = currentMonthCancelledCount;
        state.currency = currency;
      })
      .addCase(fetchSummaryThunk.rejected, (state, action) => {
        console.error(action.payload || action.error); // eslint-disable-line
        state.summaryFetchInProgress = false;
      });
  },
});

export default myBalancePageSlice.reducer;

// Shared query config for transaction includes/fields
const txQueryConfig = {
  only: 'sale',
  include: [
    'listing',
    'provider',
    'provider.profileImage',
    'customer',
    'customer.profileImage',
    'booking',
  ],
  'fields.transaction': [
    'processName',
    'lastTransition',
    'lastTransitionedAt',
    'transitions',
    'payinTotal',
    'payoutTotal',
    'lineItems',
  ],
  'fields.listing': ['title', 'availabilityPlan', 'publicData.listingType'],
  'fields.user': ['profile.displayName', 'profile.abbreviatedName', 'deleted', 'banned'],
  'fields.image': ['variants.square-small', 'variants.square-small2x'],
};

// Thunk: load paginated, filtered transaction list
const loadTransactionsPayloadCreator = ({ search }, { dispatch, rejectWithValue, extra: sdk }) => {
  const searchParams = parse(search);
  const { page = 1 } = searchParams;
  const processNames = paymentProcessNames();
  const filterParams = buildFilteredQueryParams(searchParams, { only: 'sale' });

  const apiQueryParams = {
    ...txQueryConfig,
    processNames: filterParams.processNames || processNames,
    page,
    perPage: PAGE_SIZE,
  };

  // Apply filter-specific params
  if (filterParams.lastTransitions) {
    apiQueryParams.lastTransitions = filterParams.lastTransitions;
  }
  if (filterParams.createdAtStart) {
    apiQueryParams.createdAtStart = filterParams.createdAtStart;
  }
  if (filterParams.createdAtEnd) {
    apiQueryParams.createdAtEnd = filterParams.createdAtEnd;
  }

  return sdk.transactions
    .query(apiQueryParams)
    .then(response => {
      dispatch(addMarketplaceEntities(response));
      return response;
    })
    .catch(e => rejectWithValue(storableError(e)));
};

export const loadTransactionsThunk = createAsyncThunk(
  'MyBalancePage/loadTransactions',
  loadTransactionsPayloadCreator
);

const sumPayoutAmounts = txs => {
  let total = 0;
  let currency = null;
  txs.forEach(tx => {
    const payout = tx.attributes.payoutTotal;
    if (payout) {
      total += payout.amount;
      if (!currency) currency = payout.currency;
    }
  });
  return { total, currency };
};

const computePending = (allTxs, completedTxs, cancelledTxs) => {
  const completedIds = new Set(completedTxs.map(tx => tx.id.uuid));
  const cancelledIds = new Set(cancelledTxs.map(tx => tx.id.uuid));
  let pendingTotal = 0;
  let currency = null;
  allTxs.forEach(tx => {
    if (!completedIds.has(tx.id.uuid) && !cancelledIds.has(tx.id.uuid)) {
      const payout = tx.attributes.payoutTotal;
      if (payout) {
        pendingTotal += payout.amount;
        if (!currency) currency = payout.currency;
      }
    }
  });
  return { pendingTotal, currency };
};

// Thunk: fetch summary totals (6 parallel queries: 3 all-time + 3 current month)
const fetchSummaryPayloadCreator = (_, { rejectWithValue, extra: sdk }) => {
  const processNames = paymentProcessNames();
  const completedTransitions = getCompletedTransitions();
  const refundedTransitions = getRefundedTransitions();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const baseParams = {
    only: 'sale',
    processNames,
    'fields.transaction': ['payoutTotal', 'lastTransition'],
    perPage: SUMMARY_PER_PAGE,
  };

  const monthParams = { ...baseParams, createdAtStart: currentMonthStart };

  return Promise.all([
    sdk.transactions.query({ ...baseParams, lastTransitions: completedTransitions }),
    sdk.transactions.query({ ...baseParams, lastTransitions: refundedTransitions }),
    sdk.transactions.query(baseParams),
    sdk.transactions.query({ ...monthParams, lastTransitions: completedTransitions }),
    sdk.transactions.query({ ...monthParams, lastTransitions: refundedTransitions }),
    sdk.transactions.query(monthParams),
  ])
    .then(([completedRes, cancelledRes, allRes, mCompletedRes, mCancelledRes, mAllRes]) => {
      const completedTxs = completedRes.data.data;
      const cancelledTxs = cancelledRes.data.data;
      const allTxs = allRes.data.data;
      const mCompletedTxs = mCompletedRes.data.data;
      const mCancelledTxs = mCancelledRes.data.data;
      const mAllTxs = mAllRes.data.data;

      const { total: completedTotalAmount, currency: c1 } = sumPayoutAmounts(completedTxs);
      const { pendingTotal: pendingTotalAmount, currency: c2 } = computePending(
        allTxs,
        completedTxs,
        cancelledTxs
      );
      const { total: currentMonthCompletedAmount, currency: c3 } = sumPayoutAmounts(mCompletedTxs);
      const { pendingTotal: currentMonthPendingAmount } = computePending(
        mAllTxs,
        mCompletedTxs,
        mCancelledTxs
      );

      const currency = c1 || c2 || c3 || null;

      return {
        completedTotalAmount,
        pendingTotalAmount,
        cancelledCount: cancelledRes.data.meta?.totalItems || cancelledTxs.length,
        currentMonthCompletedAmount,
        currentMonthPendingAmount,
        currentMonthCancelledCount: mCancelledRes.data.meta?.totalItems || mCancelledTxs.length,
        currency,
      };
    })
    .catch(e => rejectWithValue(storableError(e)));
};

export const fetchSummaryThunk = createAsyncThunk(
  'MyBalancePage/fetchSummary',
  fetchSummaryPayloadCreator
);

export const loadData = (params, search) => dispatch => {
  return Promise.all([
    dispatch(loadTransactionsThunk({ search })),
    dispatch(fetchSummaryThunk()),
  ]);
};
