// AV-specific transaction-related config used by upstream components.
//
// extraOrderBreakdownLineItems: AV components rendered after the provider commission
// line in OrderBreakdown.js. Each component receives:
//   { lineItems, isProvider, marketplaceName, intl }
//
// The percentage/minimum and fixed provider commissions are combined by the
// standard provider commission renderer, so no extra row is registered here.

export const extraOrderBreakdownLineItems = [];
