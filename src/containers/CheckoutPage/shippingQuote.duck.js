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
  activeRequestId: null,
};

export default function reducer(state = initialState, action = {}) {
  const { type, payload } = action;
  switch (type) {
    case QUOTE_REQUEST:
      return { ...initialState, status: 'quoting', activeRequestId: payload.requestId };
    case QUOTE_SUCCESS:
      if (state.activeRequestId !== payload.requestId) return state;
      return {
        status: 'quoted',
        quoteToken: payload.quote.quoteToken,
        express: payload.quote.express || null,
        estandar: payload.quote.estandar || null,
        rawRates: payload.quote.rawRates || [],
        errorCode: null,
        activeRequestId: null,
      };
    case QUOTE_ERROR:
      if (state.activeRequestId !== payload.requestId) return state;
      return {
        ...initialState,
        status: 'error',
        errorCode: payload.code,
        activeRequestId: null,
      };
    case QUOTE_RESET:
      return initialState;
    default:
      return state;
  }
}

// ================ Action creators ================ //

export const shippingQuoteRequest = requestId => ({ type: QUOTE_REQUEST, payload: { requestId } });
export const shippingQuoteSuccess = (requestId, quote) => ({
  type: QUOTE_SUCCESS,
  payload: { requestId, quote },
});
export const shippingQuoteError = (requestId, code) => ({
  type: QUOTE_ERROR,
  payload: { requestId, code },
});
export const shippingQuoteReset = () => ({ type: QUOTE_RESET });

// ================ Thunks ================ //

// Quote eShip via the server. Sends JSON (the route uses express.json()), so we
// fetch directly rather than through util/api's transit-serializing helper.
let requestSequence = 0;

export const fetchShippingQuote = ({ listingId, destination, buyerEmail }) => dispatch => {
  const requestId = ++requestSequence;
  dispatch(shippingQuoteRequest(requestId));
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
          dispatch(shippingQuoteError(requestId, code));
          return null;
        }
        dispatch(shippingQuoteSuccess(requestId, data));
        return data;
      })
    )
    .catch(() => {
      dispatch(shippingQuoteError(requestId, 'ESHIP_ERROR'));
      return null;
    });
};
