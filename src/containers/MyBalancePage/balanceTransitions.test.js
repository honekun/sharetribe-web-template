import { getSupportedProcessesInfo, INQUIRY_PROCESS_NAME } from '../../transactions/transaction';
import {
  getCompletedTransitions,
  getRefundedTransitions,
} from '../../transactions/transactionHelpers';

// The balance summary endpoint cannot import the process graphs (server code is
// CommonJS, src/ is the browser bundle), so it pins its own copy of these lists.
// This keeps the copy honest: a process change that moves a transition between
// buckets fails here until server/api/my-balance/balanceTransitions.js follows.
const {
  PAYMENT_PROCESS_NAMES,
  COMPLETED_TRANSITIONS,
  REFUNDED_TRANSITIONS,
} = require('../../../server/api/my-balance/balanceTransitions');

const sorted = list => [...list].sort();

describe('server balance transitions', () => {
  it('match the payment processes the client supports', () => {
    const clientProcessNames = getSupportedProcessesInfo()
      .map(p => p.name)
      .filter(name => name !== INQUIRY_PROCESS_NAME);
    expect(sorted(PAYMENT_PROCESS_NAMES)).toEqual(sorted(clientProcessNames));
  });

  it('match the client completed transitions', () => {
    expect(sorted(COMPLETED_TRANSITIONS)).toEqual(sorted(getCompletedTransitions()));
  });

  it('match the client refunded transitions', () => {
    expect(sorted(REFUNDED_TRANSITIONS)).toEqual(sorted(getRefundedTransitions()));
  });
});
