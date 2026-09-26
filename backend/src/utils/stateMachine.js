// =====================================================================
// Ride lifecycle state machine.
//
//   REQUESTED -> ACCEPTED -> DRIVER_ARRIVED -> STARTED -> COMPLETED
//
// CANCELLED is reachable from any state BEFORE the trip physically
// starts (REQUESTED, ACCEPTED, DRIVER_ARRIVED). Once STARTED, a ride
// can only become COMPLETED - you can't cancel a trip already in
// motion in this model (that would need a different "aborted" concept,
// listed as a future improvement in the README).
//
// Every route handler MUST call assertTransitionAllowed() before
// writing a new status - this is the single choke point that makes
// "REQUESTED -> COMPLETED" etc. impossible anywhere in the system.
// =====================================================================

const TRANSITIONS = {
  REQUESTED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

class InvalidTransitionError extends Error {
  constructor(from, to) {
    super(`Invalid ride state transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
    this.statusCode = 409;
  }
}

function isTransitionAllowed(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

function assertTransitionAllowed(from, to) {
  if (!isTransitionAllowed(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

module.exports = { TRANSITIONS, isTransitionAllowed, assertTransitionAllowed, InvalidTransitionError };
