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
        const { completedTotalAmount, pendingTotalAmount, cancelledCount, currency } =
          action.payload;
        state.summaryFetchInProgress = false;
        state.completedTotalAmount = completedTotalAmount;
        state.pendingTotalAmount = pendingTotalAmount;
        state.cancelledCount = cancelledCount;
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

// Thunk: fetch summary totals (3 parallel queries)
const fetchSummaryPayloadCreator = (_, { rejectWithValue, extra: sdk }) => {
  const processNames = paymentProcessNames();
  const completedTransitions = getCompletedTransitions();
  const refundedTransitions = getRefundedTransitions();

  const baseParams = {
    only: 'sale',
    processNames,
    'fields.transaction': ['payoutTotal', 'lastTransition'],
    perPage: SUMMARY_PER_PAGE,
  };

  const completedQuery = sdk.transactions.query({
    ...baseParams,
    lastTransitions: completedTransitions,
  });

  const cancelledQuery = sdk.transactions.query({
    ...baseParams,
    lastTransitions: refundedTransitions,
  });

  // For pending: query all and we'll get total count minus completed and cancelled
  // Actually, SDK doesn't support "NOT in transitions", so we query all
  // and compute pending = all - completed - cancelled counts
  // But a simpler approach: just query without lastTransitions filter
  // and use the total from that alongside the completed/cancelled totals

  return Promise.all([completedQuery, cancelledQuery])
    .then(([completedRes, cancelledRes]) => {
      const completedTxs = completedRes.data.data;
      const cancelledTxs = cancelledRes.data.data;

      // Sum payoutTotal from completed transactions
      let completedTotalAmount = 0;
      let currency = null;
      completedTxs.forEach(tx => {
        const payout = tx.attributes.payoutTotal;
        if (payout) {
          completedTotalAmount += payout.amount;
          if (!currency) currency = payout.currency;
        }
      });

      // Sum payoutTotal from pending transactions (not completed, not cancelled)
      // We need another query for pending totals
      // For now, we'll do a 3rd query excluding completed and cancelled
      // Since SDK doesn't support exclusion, let's query all and subtract
      return sdk.transactions
        .query({
          ...baseParams,
          perPage: SUMMARY_PER_PAGE,
        })
        .then(allRes => {
          const allTxs = allRes.data.data;
          const completedIds = new Set(completedTxs.map(tx => tx.id.uuid));
          const cancelledIds = new Set(cancelledTxs.map(tx => tx.id.uuid));

          let pendingTotalAmount = 0;
          allTxs.forEach(tx => {
            const txId = tx.id.uuid;
            if (!completedIds.has(txId) && !cancelledIds.has(txId)) {
              const payout = tx.attributes.payoutTotal;
              if (payout) {
                pendingTotalAmount += payout.amount;
                if (!currency) currency = payout.currency;
              }
            }
          });

          return {
            completedTotalAmount,
            pendingTotalAmount,
            cancelledCount: cancelledRes.data.meta?.totalItems || cancelledTxs.length,
            currency,
          };
        });
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
