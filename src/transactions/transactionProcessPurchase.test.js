import { graph, isRelevantPastTransition, states, transitions } from './transactionProcessPurchase';

describe('default purchase eShip pickup transitions', () => {
  test('keeps purchased and delivered transactions in the same state', () => {
    expect(graph.states[states.PURCHASED].on[transitions.ESHIP_PICKED_UP_FROM_PURCHASED]).toBe(
      states.PURCHASED
    );
    expect(graph.states[states.DELIVERED].on[transitions.ESHIP_PICKED_UP_FROM_DELIVERED]).toBe(
      states.DELIVERED
    );
  });

  test('hides internal carrier transitions from the activity feed', () => {
    expect(isRelevantPastTransition(transitions.ESHIP_PICKED_UP_FROM_PURCHASED)).toBe(false);
    expect(isRelevantPastTransition(transitions.ESHIP_PICKED_UP_FROM_DELIVERED)).toBe(false);
  });
});
