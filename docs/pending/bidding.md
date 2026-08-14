# Bidding and offer acceptance

Status: product and transaction architecture decision required; no bidding implementation is
approved.

## Current constraint

A Sharetribe listing has one `transactionProcessAlias` and one unit type. A listing configured for
`default-purchase` cannot also initiate `default-negotiation` transactions. The current purchase
listing therefore supports immediate checkout, not a second offer flow.

The bundled `default-negotiation/release-1` process is not a direct buyer-bid flow:

- Provider-authored `offer` listing: the customer requests a quote, the provider submits the first
  numeric offer, and the customer may counter later.
- Customer-authored `request` listing: a provider submits the first offer.

Creating a Console listing type that uses `unitType: offer` can expose this existing quote workflow,
but it does not let a buyer immediately submit a lower bid on a normal product listing. It also
replaces immediate purchase rather than adding a second mode.

## Product decision

Choose one behavior before implementation:

1. **Quote negotiation as implemented.** Create a separate negotiation listing type and accept the
   existing customer-request/provider-offer sequence. This needs Console and end-to-end
   verification, but may not match the intended bidding product.
2. **True hybrid purchase and buyer offer.** Design a transaction process with both immediate
   checkout and a customer-submitted offer path. This is the cleanest single-listing model but
   requires a matching hosted process, application state-machine support, notifications, payment,
   cancellation, inventory, and migration decisions.
3. **Paired purchase and negotiation listings.** Keep separate processes and connect two listings in
   application code. This avoids a new hosted process but introduces synchronization problems for
   price, stock, images, closure, moderation, search visibility, and transaction support. Treat it
   as high-maintenance and use only with a compelling product reason.

Do not describe a pre-filled provider quote or a paired listing as “Buy now”; neither provides the
same atomic inventory and immediate-payment guarantees as the purchase process.

## Questions that block design

- Who submits the first numeric offer: buyer or seller?
- Must **Buy now** and **Make an offer** coexist on the same listing?
- Does submitting or accepting an offer reserve stock, and for how long?
- May sellers counter, reject, or allow offers to expire?
- What is the minimum offer and who configures it?
- When does Stripe payment authorization happen?
- Which purchase cancellation, delivery, dispute, review, shipping, and payout semantics must be
  preserved?
- How are existing listings and in-flight transactions migrated?

## Required implementation gate

Transaction-process, transition, payment, inventory, cancellation, and payout changes require
explicit user approval. Before code changes:

- [ ] Approve the user journey and answers above.
- [ ] Confirm the exact process alias and unit type in Sharetribe Test.
- [ ] Update or create the hosted transaction process and email templates through the supported
      Sharetribe workflow.
- [ ] Map every state and transition in `src/transactions/transactionProcessNegotiation.js` (or a
      new process module) and the transaction-page state data.
- [ ] Design server-authoritative line items, stock reservation, eShip behavior, Stripe payment,
      cancellation/refund, and notification recipient rules.
- [ ] Add process, UI, SSR, notification, and end-to-end tests before Live configuration changes.

## Current implementation sources

- `ext/transaction-processes/default-negotiation/process.edn`
- `src/transactions/transactionProcessNegotiation.js`
- `src/components/OrderPanel/OrderPanel.js`
- `src/containers/RequestQuotePage/`
- `src/containers/MakeOfferPage/`
- `src/containers/TransactionPage/`
- `src/containers/ListingPage/ListingPage.shared.js`
