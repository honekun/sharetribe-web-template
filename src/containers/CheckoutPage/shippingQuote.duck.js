import { apiBaseUrl } from '../../util/api';

// ================ Action types ================ //

export const QUOTE_REQUEST = 'app/CheckoutPage/shippingQuote/REQUEST';
export const QUOTE_SUCCESS = 'app/CheckoutPage/shippingQuote/SUCCESS';
export const QUOTE_ERROR = 'app/CheckoutPage/shippingQuote/ERROR';
export const QUOTE_RESET = 'app/CheckoutPage/shippingQuote/RESET';

// ================ Reducer ================ //

const initialState = {
  status: 'idle', // idle | quoting | quoted | error
  quoteToken: null,
  express: null,
  estandar: null,
  rawRates: [],
  errorCode: null,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case QUOTE_REQUEST:
      return { ...initialState, status: 'quoting' };
    case QUOTE_SUCCESS:
      return {
        status: 'quoted',
        quoteToken: payload.quoteToken,
        express: payload.express || null,
        estandar: payload.estandar || null,
        rawRates: payload.rawRates || [],
        errorCode: null,
      };
    case QUOTE_ERROR:
      return { ...initialState, status: 'error', errorCode: payload };
    case QUOTE_RESET:
      return initialState;
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const shippingQuoteRequest = () => ({ type: QUOTE_REQUEST });
export const shippingQuoteSuccess = payload => ({ type: QUOTE_SUCCESS, payload });
export const shippingQuoteError = code => ({ type: QUOTE_ERROR, payload: code });
export const shippingQuoteReset = () => ({ type: QUOTE_RESET });

// ================ Thunks ================ //

// Quote eShip via the server. Sends JSON (the route uses express.json()), so we
// fetch directly rather than through util/api's transit-serializing helper.
export const fetchShippingQuote = ({ listingId, destination, buyerEmail }) => dispatch => {
  dispatch(shippingQuoteRequest());
  return window
    .fetch(`${apiBaseUrl()}/api/shipping/quote`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, destination, buyerEmail }),
    })
    .then(res =>
      res.json().then(data => {
        if (!res.ok) {
          const code = data?.code || 'ESHIP_ERROR';
          dispatch(shippingQuoteError(code));
          return null;
        }
        dispatch(shippingQuoteSuccess(data));
        return data;
      })
    )
    .catch(() => {
      dispatch(shippingQuoteError('ESHIP_ERROR'));
      return null;
    });
};
