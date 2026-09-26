const { isTransitionAllowed, assertTransitionAllowed, InvalidTransitionError } = require('../src/utils/stateMachine');

// Test 2 (spec): invalid state transitions are rejected, e.g. REQUESTED -> COMPLETED.
describe('Ride lifecycle state machine', () => {
  test('rejects skipping straight from REQUESTED to COMPLETED', () => {
    expect(isTransitionAllowed('REQUESTED', 'COMPLETED')).toBe(false);
    expect(() => assertTransitionAllowed('REQUESTED', 'COMPLETED')).toThrow(InvalidTransitionError);
  });

  test('rejects skipping straight from REQUESTED to STARTED', () => {
    expect(isTransitionAllowed('REQUESTED', 'STARTED')).toBe(false);
  });

  test('allows the full happy-path lifecycle in order', () => {
    expect(isTransitionAllowed('REQUESTED', 'ACCEPTED')).toBe(true);
    expect(isTransitionAllowed('ACCEPTED', 'DRIVER_ARRIVED')).toBe(true);
    expect(isTransitionAllowed('DRIVER_ARRIVED', 'STARTED')).toBe(true);
    expect(isTransitionAllowed('STARTED', 'COMPLETED')).toBe(true);
  });

  test('allows cancellation from REQUESTED, ACCEPTED, and DRIVER_ARRIVED', () => {
    expect(isTransitionAllowed('REQUESTED', 'CANCELLED')).toBe(true);
    expect(isTransitionAllowed('ACCEPTED', 'CANCELLED')).toBe(true);
    expect(isTransitionAllowed('DRIVER_ARRIVED', 'CANCELLED')).toBe(true);
  });

  test('rejects cancellation once a trip has STARTED or COMPLETED', () => {
    expect(isTransitionAllowed('STARTED', 'CANCELLED')).toBe(false);
    expect(isTransitionAllowed('COMPLETED', 'CANCELLED')).toBe(false);
  });

  test('terminal states (COMPLETED, CANCELLED) allow no further transitions', () => {
    expect(isTransitionAllowed('COMPLETED', 'REQUESTED')).toBe(false);
    expect(isTransitionAllowed('CANCELLED', 'ACCEPTED')).toBe(false);
  });
});
