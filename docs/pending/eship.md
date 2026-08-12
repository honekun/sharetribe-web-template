# Pending eShip policy and reconciliation

Status: open business, support, and accounting decisions. These items do not change the current
quote or manual label-purchase implementation documented in
[`integrations/eship.md`](../integrations/eship.md).

## Current safety boundary

- Keep `ESHIP_LABEL_AUTOBUY=false`; sellers purchase labels manually after payment.
- eShip bills Archivo Vintach directly. The buyer-facing shipping line item is retained by the
  platform rather than paid to the seller.
- `protectedData.avShipping` records what the buyer paid and `metadata.avLabel` records the label
  outcome. The application does not currently void a carrier label or adjust a Stripe refund for its
  cost.
- `eshipAmountIncludesIva=false`; the buyer-price calculation currently treats IVA as part of the
  markup buffer.
- Operators must not promise automatic label refunds, credits, or tax treatment that has not been
  approved.

## 1. Purchased-label cancellation and refund policy

Decide and document:

- whether a purchased eShip label can be voided, within what time window, and how a carrier credit
  is verified;
- who absorbs a non-refundable carrier charge when the buyer, seller, or marketplace cancels;
- whether full and partial Stripe refunds include the buyer's shipping charge;
- how `unknown` purchase outcomes are reconciled before any resend or refund;
- which operator role may approve an exception and where evidence is recorded; and
- how the carrier charge, buyer shipping payment, refund, and seller payout are reconciled per
  transaction.

Completion requires an approved operator procedure, an accounting owner, representative tests for
each cancellation path, and any necessary Stripe/transaction-process changes. Transaction-process or
payout changes require explicit approval and matching Sharetribe configuration.

## 2. IVA treatment

Reconcile a representative set of production eShip invoices against quotation and shipment
responses, then determine whether the carrier `amount` is tax-inclusive and how IVA must appear in
Archivo Vintach's accounting. Record:

- quote amount, shipment charge, invoice subtotal, IVA, credit, and final total;
- the approved meaning of `eshipAmountIncludesIva` and whether price math must change;
- the required markup or rounding behavior after tax treatment; and
- the finance owner and date of approval.

Completion requires documented invoice evidence, an approved accounting rule, updated current
documentation, and automated tests for any price-math change.

## Rollout gate

After both decisions are complete, update the operator guide and current eShip guide, run the Test
environment cancellation/refund matrix, reconcile the results, and only then consider enabling
`ESHIP_LABEL_AUTOBUY`.
