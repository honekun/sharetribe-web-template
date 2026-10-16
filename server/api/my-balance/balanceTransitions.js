'use strict';

// Server-owned copy of the transition lists the balance summary buckets by.
// The client derives the same lists from the process graphs in src/transactions
// (getCompletedTransitions / getRefundedTransitions, excluding the inquiry
// process). Server code cannot import src/ (ESM, browser bundle), and the
// summary must not trust lists the caller sends, so they are pinned here.
// src/containers/MyBalancePage/balanceTransitions.test.js fails the build when
// a process change makes the two drift.

const PAYMENT_PROCESS_NAMES = [
  'default-purchase',
  'default-booking',
  'default-negotiation',
  'default-download',
];

const COMPLETED_TRANSITIONS = [
  'transition/auto-complete',
  'transition/expire-review-period',
  'transition/review-1-by-customer',
  'transition/review-1-by-provider',
  'transition/review-2-by-provider',
  'transition/expire-provider-review-period',
  'transition/review-2-by-customer',
  'transition/expire-customer-review-period',
  'transition/complete',
  'transition/operator-complete',
  'transition/accept-deliverable',
  'transition/auto-accept-deliverable',
  'transition/operator-accept-deliverable',
  'transition/operator-complete-from-reported',
  'transition/review',
];

const REFUNDED_TRANSITIONS = [
  'transition/expire-payment',
  'transition/auto-cancel',
  'transition/cancel',
  'transition/auto-cancel-from-disputed',
  'transition/cancel-from-disputed',
  'transition/decline',
  'transition/expire',
  'transition/operator-cancel',
  'transition/operator-cancel-from-delivered',
  'transition/auto-cancel-from-changes-requested',
  'transition/operator-cancel-from-changes-requested',
];

module.exports = { PAYMENT_PROCESS_NAMES, COMPLETED_TRANSITIONS, REFUNDED_TRANSITIONS };
