import { createSlice } from '@reduxjs/toolkit';

const createTypePageSlice = createSlice({
  name: 'CreateTypePage',
  initialState: {},
  reducers: {},
});

export default createTypePageSlice.reducer;

export const loadData = () => () => Promise.resolve();
