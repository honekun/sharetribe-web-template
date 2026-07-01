import { storableError } from '../../util/errors';
import { fetchCurrentUser } from '../../ducks/user.duck';

// ================ Action types ================ //

export const SAVE_REQUEST = 'app/MyAddressesPage/SAVE_REQUEST';
export const SAVE_SUCCESS = 'app/MyAddressesPage/SAVE_SUCCESS';
export const SAVE_ERROR = 'app/MyAddressesPage/SAVE_ERROR';
export const SAVE_CLEAR = 'app/MyAddressesPage/SAVE_CLEAR';

// ================ Reducer ================ //

const initialState = {
  saveInProgress: false,
  saveError: null,
  saveSuccess: false,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case SAVE_REQUEST:
      return { ...state, saveInProgress: true, saveError: null, saveSuccess: false };
    case SAVE_SUCCESS:
      return { ...state, saveInProgress: false, saveSuccess: true };
    case SAVE_ERROR:
      return { ...state, saveInProgress: false, saveError: payload };
    case SAVE_CLEAR:
      return { ...state, saveError: null, saveSuccess: false };
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const saveAddressRequest = () => ({ type: SAVE_REQUEST });
export const saveAddressSuccess = () => ({ type: SAVE_SUCCESS });
export const saveAddressError = error => ({ type: SAVE_ERROR, payload: error });
export const saveAddressClear = () => ({ type: SAVE_CLEAR });

// ================ Thunks ================ //

// Save the buyer's reusable shipping address. Single address for now (the field
// shape is list-ready, so this can become `shippingAddresses: [...]` later).
export const saveAddress = shippingAddress => (dispatch, getState, sdk) => {
  dispatch(saveAddressRequest());
  return sdk.currentUser
    .updateProfile({ protectedData: { shippingAddress } }, { expand: true })
    .then(() => {
      dispatch(saveAddressSuccess());
      return dispatch(fetchCurrentUser());
    })
    .catch(e => dispatch(saveAddressError(storableError(e))));
};

export const loadData = () => dispatch => {
  // currentUser is loaded globally; ensure it's fresh for the form's initial values.
  return dispatch(fetchCurrentUser());
};
