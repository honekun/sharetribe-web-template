import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import merge from 'lodash/merge';
import { denormalisedResponseEntities } from '../../util/data';
import { storableError } from '../../util/errors';
import { getMarketingPreference, updateMarketingPreference } from '../../util/api';
import { fetchCurrentUser, setCurrentUser } from '../../ducks/user.duck';

// ================ Async thunks ================ //

export const resetPasswordThunk = createAsyncThunk(
  'ContactDetailsPage/resetPassword',
  ({ email }, { extra: sdk, rejectWithValue }) => {
    return sdk.passwordReset.request({ email }).catch(e => {
      return rejectWithValue(storableError(e));
    });
  }
);
// Backward compatible wrapper for the resetPassword thunk
export const resetPassword = email => dispatch => {
  return dispatch(resetPasswordThunk({ email })).unwrap();
};

export const fetchMarketingPreferenceThunk = createAsyncThunk(
  'ContactDetailsPage/fetchMarketingPreference',
  (_, { rejectWithValue }) => getMarketingPreference().catch(e => rejectWithValue(storableError(e)))
);

export const fetchMarketingPreference = () => dispatch =>
  dispatch(fetchMarketingPreferenceThunk()).unwrap();

export const saveMarketingPreferenceThunk = createAsyncThunk(
  'ContactDetailsPage/saveMarketingPreference',
  ({ enabled }, { rejectWithValue }) =>
    updateMarketingPreference({ enabled, source: 'account_details' }).catch(e =>
      rejectWithValue(storableError(e))
    )
);

export const savePhoneNumberThunk = createAsyncThunk(
  'ContactDetailsPage/savePhoneNumber',
  ({ phoneNumber }, { dispatch, extra: sdk, rejectWithValue }) => {
    return sdk.currentUser
      .updateProfile(
        { protectedData: { phoneNumber } },
        {
          expand: true,
          include: ['profileImage'],
          'fields.image': ['variants.square-small', 'variants.square-small2x'],
        }
      )
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.updateProfile response');
        }
        dispatch(setCurrentUser(entities[0]));
        return entities[0];
      })
      .catch(e => {
        return rejectWithValue(storableError(e));
      });
  }
);
// Backward compatible wrapper for the requestSavePhoneNumber thunk
export const savePhoneNumber = params => dispatch => {
  return dispatch(requestSavePhoneNumberThunk({ phoneNumber: params.phoneNumber })).unwrap();
};

export const saveEmailThunk = createAsyncThunk(
  'ContactDetailsPage/requestSaveEmail',
  ({ email, currentPassword }, { dispatch, extra: sdk, rejectWithValue }) => {
    return sdk.currentUser
      .changeEmail(
        { email, currentPassword },
        {
          expand: true,
          include: ['profileImage'],
          'fields.image': ['variants.square-small', 'variants.square-small2x'],
        }
      )
      .then(response => {
        const entities = denormalisedResponseEntities(response);
        if (entities.length !== 1) {
          throw new Error('Expected a resource in the sdk.currentUser.changeEmail response');
        }
        dispatch(setCurrentUser(entities[0]));
        return entities[0];
      })
      .catch(e => {
        return rejectWithValue(storableError(e));
      });
  }
);
// Backward compatible wrapper for the requestSaveEmail thunk
export const saveEmail = params => dispatch => {
  return dispatch(
    saveEmailThunk({ email: params.email, currentPassword: params.currentPassword })
  ).unwrap();
};

export const saveEmailAndPhoneNumberThunk = createAsyncThunk(
  'ContactDetailsPage/saveEmailAndPhoneNumber',
  ({ email, phoneNumber, currentPassword }, { dispatch, rejectWithValue }) => {
    const promises = [
      dispatch(saveEmailThunk({ email, currentPassword })).unwrap(),
      dispatch(savePhoneNumberThunk({ phoneNumber })).unwrap(),
    ];

    return Promise.all(promises)
      .then(values => {
        const saveEmailUser = values[0];
        const savePhoneNumberUser = values[1];

        const protectedData = savePhoneNumberUser.attributes.profile.protectedData;
        const phoneNumberMergeSource = { attributes: { profile: { protectedData } } };

        const currentUser = merge(saveEmailUser, phoneNumberMergeSource);
        dispatch(setCurrentUser(currentUser));
        return currentUser;
      })
      .catch(e => {
        return rejectWithValue(e);
      });
  }
);
// Backward compatible wrapper for the saveEmailAndPhoneNumber thunk
export const saveEmailAndPhoneNumber = params => dispatch => {
  return dispatch(
    saveEmailAndPhoneNumberThunk({
      email: params.email,
      currentPassword: params.currentPassword,
      phoneNumber: params.phoneNumber,
    })
  ).unwrap();
};

export const saveContactDetailsThunk = createAsyncThunk(
  'ContactDetailsPage/saveContactDetails',
  async (
    {
      email,
      currentEmail,
      phoneNumber,
      currentPhoneNumber,
      currentPassword,
      marketingConsent,
      currentMarketingConsent,
    },
    { dispatch, rejectWithValue }
  ) => {
    const emailChanged = email !== currentEmail;
    const phoneNumberChanged = phoneNumber !== currentPhoneNumber;
    const requestedMarketingConsent = Boolean(marketingConsent);
    const marketingConsentChanged = requestedMarketingConsent !== Boolean(currentMarketingConsent);

    try {
      // Consent belongs to an email address. Revoke the old address before
      // requesting an email change; the new address starts opted out and may
      // be opted in after it has been verified.
      if (emailChanged && currentMarketingConsent) {
        await dispatch(saveMarketingPreferenceThunk({ enabled: false })).unwrap();
      } else if (!emailChanged && marketingConsentChanged) {
        await dispatch(
          saveMarketingPreferenceThunk({ enabled: requestedMarketingConsent })
        ).unwrap();
      }

      if (emailChanged && phoneNumberChanged) {
        return await dispatch(
          saveEmailAndPhoneNumberThunk({ email, currentPassword, phoneNumber })
        ).unwrap();
      } else if (emailChanged) {
        return await dispatch(saveEmailThunk({ email, currentPassword })).unwrap();
      } else if (phoneNumberChanged) {
        return await dispatch(savePhoneNumberThunk({ phoneNumber })).unwrap();
      }
      return null;
    } catch (e) {
      return rejectWithValue(e);
    }
  }
);
// Backward compatible wrapper for the saveContactDetails thunk
export const saveContactDetails = params => dispatch => {
  return dispatch(saveContactDetailsThunk(params)).unwrap();
};

// ================ Slice ================ //

const contactDetailsSlice = createSlice({
  name: 'ContactDetailsPage',
  initialState: {
    saveEmailError: null,
    savePhoneNumberError: null,
    saveMarketingPreferenceError: null,
    saveContactDetailsInProgress: false,
    contactDetailsChanged: false,
    marketingPreference: null,
    marketingPreferenceLoading: false,
    resetPasswordInProgress: false,
    resetPasswordError: null,
  },
  reducers: {
    saveContactDetailsClear: state => {
      state.saveContactDetailsInProgress = false;
      state.saveEmailError = null;
      state.savePhoneNumberError = null;
      state.saveMarketingPreferenceError = null;
      state.contactDetailsChanged = false;
    },
  },
  extraReducers: builder => {
    builder
      // Reset password
      .addCase(resetPasswordThunk.pending, state => {
        state.resetPasswordInProgress = true;
        state.resetPasswordError = null;
      })
      .addCase(resetPasswordThunk.fulfilled, state => {
        state.resetPasswordInProgress = false;
      })
      .addCase(resetPasswordThunk.rejected, (state, action) => {
        console.error(action.payload);
        state.resetPasswordInProgress = false;
        state.resetPasswordError = action.payload;
      })
      // Request save phone number
      .addCase(savePhoneNumberThunk.rejected, (state, action) => {
        state.saveContactDetailsInProgress = false;
        state.savePhoneNumberError = action.payload;
      })
      // Request save email
      .addCase(saveEmailThunk.rejected, (state, action) => {
        state.saveContactDetailsInProgress = false;
        state.saveEmailError = action.payload;
      })
      .addCase(fetchMarketingPreferenceThunk.pending, state => {
        state.marketingPreferenceLoading = true;
      })
      .addCase(fetchMarketingPreferenceThunk.fulfilled, (state, action) => {
        state.marketingPreferenceLoading = false;
        state.marketingPreference = Boolean(action.payload?.enabled);
      })
      .addCase(fetchMarketingPreferenceThunk.rejected, state => {
        state.marketingPreferenceLoading = false;
      })
      .addCase(saveMarketingPreferenceThunk.fulfilled, (state, action) => {
        state.marketingPreference = Boolean(action.payload?.enabled);
      })
      .addCase(saveMarketingPreferenceThunk.rejected, (state, action) => {
        state.saveContactDetailsInProgress = false;
        state.saveMarketingPreferenceError = action.payload;
      })
      // Save contact details
      .addCase(saveContactDetailsThunk.pending, state => {
        state.saveContactDetailsInProgress = true;
        state.saveEmailError = null;
        state.savePhoneNumberError = null;
        state.saveMarketingPreferenceError = null;
        state.contactDetailsChanged = false;
      })
      .addCase(saveContactDetailsThunk.fulfilled, state => {
        state.saveContactDetailsInProgress = false;
        state.contactDetailsChanged = true;
      })
      .addCase(saveContactDetailsThunk.rejected, (state, action) => {
        state.saveContactDetailsInProgress = false;
        // Error details are handled by individual thunks
      });
  },
});

export const { saveContactDetailsClear } = contactDetailsSlice.actions;
export default contactDetailsSlice.reducer;

// ================ Load data ================ //

export const loadData = () => {
  // Since verify email happens in separate tab, current user's data might be updated
  return fetchCurrentUser();
};
