import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchBagListings } from '../../ducks/bag.duck';

const bagPageSlice = createSlice({
  name: 'BagPage',
  initialState: { fetchInProgress: false, fetchError: null, listingRefs: [] },
  reducers: {
    listingRefRemoved(state, action) {
      state.listingRefs = state.listingRefs.filter(ref => ref.id.uuid !== action.payload);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(loadBagThunk.pending, state => {
        state.fetchInProgress = true;
        state.fetchError = null;
      })
      .addCase(loadBagThunk.fulfilled, (state, action) => {
        state.fetchInProgress = false;
        state.listingRefs = action.payload;
      })
      .addCase(loadBagThunk.rejected, (state, action) => {
        state.fetchInProgress = false;
        state.fetchError = action.payload || action.error;
      });
  },
});

export const { listingRefRemoved } = bagPageSlice.actions;
export default bagPageSlice.reducer;

export const loadBagThunk = createAsyncThunk('BagPage/loadBag', (_, { dispatch }) =>
  dispatch(fetchBagListings())
);
