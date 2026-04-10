import { createSlice } from '@reduxjs/toolkit';

/**
 * Small Redux slice to store AV landing page extension data that can't
 * be derived from marketplaceData (e.g. listing IDs returned from filter queries).
 * SSR-safe: populated during loadData before render.
 */
const avExtensionSlice = createSlice({
  name: 'avLandingExtension',
  initialState: {
    // Maps sectionId → array of listing UUID strings for tag/category filter sections
    tagListingIds: {},
  },
  reducers: {
    setTagListingIds: (state, action) => {
      // action.payload: { [sectionId]: [uuidString, ...] }
      state.tagListingIds = action.payload;
    },
  },
});

export const { setTagListingIds } = avExtensionSlice.actions;
export default avExtensionSlice.reducer;
