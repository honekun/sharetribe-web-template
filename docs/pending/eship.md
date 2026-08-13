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

Status: recommended launch policy awaiting business approval, Test verification, and named owners.

### Recommended policy

Preserve the current Sharetribe purchase process: a supported cancellation issues a full Stripe
refund, including the buyer-facing shipping line item, and no ad hoc amount is deducted from the
seller payout. An unused purchased label is canceled separately in eShip and its wallet credit is
verified before the financial case is closed.

The policy does not introduce a partial refund or a seller payout adjustment:

- A valid `default-purchase` cancellation uses Sharetribe's supported operator or automatic
  cancellation transition. The current process calculates a full refund and calls Stripe's refund
  action. Because the shipping fee applies to the customer, the refund includes that fee. The
  canceled transaction creates no seller payout.
- If no label was purchased, no eShip action or carrier-cost adjustment is needed.
- If an unused label was purchased, an authorized operator cancels it separately in the eShip
  dashboard using its shipment ID or tracking number. eShip says an unused label is eligible for
  cancellation and the balance normally returns to the eShip wallet within one to three business
  days. The case remains open until the wallet credit is visible and recorded.
- If the label has been used, is already in transit, cannot be canceled, or its credit is rejected
  or absent after three business days, escalate to eShip support and the finance owner. The
  recommended launch rule is that Archivo Vintach absorbs the carrier cost. Do not reduce the
  buyer's refund or seller's payout by editing Stripe, transaction data, or a payout outside the
  hosted process.
- For an `unknown` app purchase outcome, check the eShip dashboard by transaction context, rate,
  time, destination, and seller before taking the Sharetribe cancellation. If a shipment exists,
  record it and follow the purchased-label path. If none exists, retain the evidence; only an
  allowlisted operator may release the label ledger for a retry, and there is no operator UI.

Cause attribution is recorded for reporting, not for an automatic financial deduction:

| Cancellation cause                                                                         | Buyer treatment                                                                       | Seller payout                               | Carrier-cost treatment                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| Seller did not ship or seller requested cancellation                                       | Full refund through the Sharetribe cancellation                                       | None                                        | Cancel unused label and verify wallet credit; AV absorbs an unrecovered amount          |
| Buyer requested cancellation before the label is used or the first carrier acceptance scan | Full refund only when an operator approves and the hosted cancellation is still valid | None                                        | Same unused-label cancellation and credit verification                                  |
| Marketplace, fraud, duplicate, or operational failure                                      | Full refund through the valid hosted cancellation                                     | None                                        | Same workflow; escalate an unrecovered amount to finance                                |
| Package used/in transit, delivered, lost, damaged, or returned                             | Do not treat as an unused-label cancellation                                          | Follow the active dispute/transaction state | Escalate as a carrier claim or return case; this policy does not promise a label credit |

The operator records the transaction UUID and environment, cancellation cause and approver,
Sharetribe transition, Stripe refund reference and amount, eShip shipment/tracking ID, cancellation
request and response, original carrier debit, wallet-credit amount/date, and final reconciliation
status. Do not close the financial case on the cancellation response alone.

Because the current process auto-cancels a paid order after seven days when it has not been marked
shipped, a seller must mark it shipped immediately after carrier handoff. If tracking proves carrier
acceptance but the seller missed that step, support must review the valid operator transition before
the deadline; after auto-cancellation, the full refund cannot be converted into a partial refund by
editing Stripe directly.

This recommendation is based on eShip's current public
[shipment-cancellation API reference](https://myeship.co/docs/es/) and
[unused-label refund guidance](https://help.myeship.co/en/article/how-do-i-cancel-a-label-i-wont-use-1406cw5/).
Reconfirm the behavior in the contracted account before Live use.

Remaining approval and verification items:

- [ ] Approve or replace the recommended rule that AV absorbs any carrier cost that cannot be
      recovered without an off-platform seller chargeback.
- [ ] Name the finance owner and support approver for Live exceptions.
- [ ] Select the support-ticket and finance-ledger locations where cancellation and credit evidence
      will be stored.
- [ ] Verify the eShip cancellation request and resulting wallet credit in QA/Test, recording the
      HTTP method, response, timestamps, and dashboard evidence. The public API reference documents
      the shipment cancellation resource but does not state the HTTP method in its rendered text.
- [ ] Test buyer-, seller-, and marketplace-caused cancellations before carrier acceptance.
- [ ] Confirm the handling of an in-transit/used label and a rejected or missing eShip credit.
- [ ] Confirm the escalation and evidence location for an `unknown` label-purchase outcome.
- [ ] Reconcile the buyer refund, zero seller payout, original carrier debit, and eShip wallet
      credit for every Test case.

No transaction-process or payout change is part of this policy. A future partial-refund or
seller-chargeback policy would require separate explicit approval, matching Sharetribe process
configuration, and new tests.

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

After the policy verification above and the IVA decision are complete, run the final Test
environment cancellation/refund matrix, reconcile the results, and only then consider enabling
`ESHIP_LABEL_AUTOBUY`.
