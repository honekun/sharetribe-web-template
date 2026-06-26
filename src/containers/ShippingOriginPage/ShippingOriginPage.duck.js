import { storableError } from '../../util/errors';
import { fetchCurrentUser } from '../../ducks/user.duck';

// ================ Action types ================ //

export const SAVE_REQUEST = 'app/ShippingOriginPage/SAVE_REQUEST';
export const SAVE_SUCCESS = 'app/ShippingOriginPage/SAVE_SUCCESS';
export const SAVE_ERROR = 'app/ShippingOriginPage/SAVE_ERROR';
export const SAVE_CLEAR = 'app/ShippingOriginPage/SAVE_CLEAR';

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

export const saveShippingOriginRequest = () => ({ type: SAVE_REQUEST });
export const saveShippingOriginSuccess = () => ({ type: SAVE_SUCCESS });
export const saveShippingOriginError = error => ({ type: SAVE_ERROR, payload: error });
export const saveShippingOriginClear = () => ({ type: SAVE_CLEAR });

// ================ Thunks ================ //

export const saveShippingOrigin = shippingOrigin => (dispatch, getState, sdk) => {
  dispatch(saveShippingOriginRequest());
  return sdk.currentUser
    .updateProfile({ protectedData: { shippingOrigin } }, { expand: true })
    .then(() => {
      dispatch(saveShippingOriginSuccess());
      return dispatch(fetchCurrentUser());
    })
    .catch(e => dispatch(saveShippingOriginError(storableError(e))));
};

export const loadData = () => dispatch => {
  // currentUser is loaded globally; ensure it's fresh for the form's initial values.
  return dispatch(fetchCurrentUser());
};
