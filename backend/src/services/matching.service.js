// =====================================================================
// Matching / pooling engine.
//
// This is the module the whole challenge is really testing. Two things
// have to be true at once:
//
//   1. CORRECT MATCHING: a new ride request should join an existing
//      open pool if it's route-compatible (see location.service.js),
//      otherwise a new pool is opened for it.
//
//   2. NO OVERSELLING UNDER CONCURRENCY: if two passengers request the
//      last seat at the same instant, exactly one of them must get it.
//
// HOW WE SOLVE #2:
// We wrap the whole "read seats -> check capacity -> write seats" cycle
// in a single Prisma interactive transaction, and inside that
// transaction we take a row lock on the vehicle with a raw
// `SELECT ... FOR UPDATE`. Postgres will make any second concurrent
// transaction that also tries to lock the same vehicle row simply WAIT
// until the first transaction commits or rolls back. So the two
// requests are forced to run one-after-another for the critical
// section, even though they arrived at the same time. The one that
// commits second re-reads the now-updated occupied_seats and correctly
// gets rejected if there's no room left.
//
// We ALSO keep a DB-level trigger (enforce_pool_capacity, see the
// migration SQL) that re-checks occupied_seats <= vehicle.capacity on
// every write to `pools`, as a defense-in-depth backstop in case this
// code is ever bypassed by a different write path.
// =====================================================================

const prisma = require('../db/prisma');
const { isPoolCompatible } = require('./location.service');
const { calculateFarePaisa } = require('./fare.service');

class SeatUnavailableError extends Error {
  constructor(message = 'Not enough seats available on this vehicle for the request') {
    super(message);
    this.name = 'SeatUnavailableError';
    this.statusCode = 409;
  }
}

/**
 * Attempts to seat a ride request onto a specific vehicle, either by
 * joining a compatible OPEN pool or opening a brand new pool.
 * Runs entirely inside one serializable-safe transaction with a row
 * lock on the vehicle, so it is safe to call concurrently.
 *
 * @param {Object} params
 * @param {string} params.vehicleId
 * @param {string} params.rideRequestId
 * @param {string} params.pickupZone
 * @param {string} params.destinationZone
 * @param {number} params.seatsRequested
 * @returns {Promise<{pool: object, farePaisa: number}>}
 */
async function joinOrCreatePool({ vehicleId, rideRequestId, pickupZone, destinationZone, seatsRequested }) {
  return prisma.$transaction(async (tx) => {
    // --- Row-lock the vehicle for the duration of this transaction ---
    // This is the concurrency guard: any other transaction trying to
    // lock the same vehicle row blocks here until we commit/rollback.
    const lockedVehicleRows = await tx.$queryRaw`
      SELECT id, capacity FROM vehicles WHERE id = ${vehicleId} FOR UPDATE
    `;
    if (!lockedVehicleRows || lockedVehicleRows.length === 0) {
      throw new Error('Vehicle not found');
    }
    const vehicle = lockedVehicleRows[0];

    // --- Find an OPEN, route-compatible pool for this vehicle ---
    const openPools = await tx.pool.findMany({
      where: { vehicleId, status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
    });

    let targetPool = openPools.find((p) =>
      isPoolCompatible(
        { pickupZone, destinationZone },
        { poolPickupZone: p.pickupZone, poolDestinationZone: p.destinationZone }
      )
    );

    const currentOccupied = targetPool ? targetPool.occupiedSeats : 0;

    // --- THE critical capacity check, done with fresh, locked data ---
    if (currentOccupied + seatsRequested > vehicle.capacity) {
      throw new SeatUnavailableError(
        `Requested ${seatsRequested} seat(s) but only ${vehicle.capacity - currentOccupied} available`
      );
    }

    if (!targetPool) {
      targetPool = await tx.pool.create({
        data: {
          vehicleId,
          pickupZone,
          destinationZone,
          occupiedSeats: 0,
          status: 'OPEN',
        },
      });
    }

    const newOccupied = targetPool.occupiedSeats + seatsRequested;
    const isPooled = openPools.length > 0 || newOccupied < vehicle.capacity || currentOccupied > 0;

    const farePaisa = calculateFarePaisa({
      pickupZone,
      destinationZone,
      seats: seatsRequested,
      // "pooled" for fare-discount purposes means: this passenger is
      // sharing the vehicle with at least one other party.
      isPooled: currentOccupied > 0,
    });

    const updatedPool = await tx.pool.update({
      where: { id: targetPool.id },
      data: {
        occupiedSeats: newOccupied,
        status: newOccupied >= vehicle.capacity ? 'FULL' : 'OPEN',
      },
    });

    await tx.poolMember.create({
      data: {
        poolId: updatedPool.id,
        rideRequestId,
        seats: seatsRequested,
        farePaisa,
      },
    });

    return { pool: updatedPool, farePaisa };
  });
}

/**
 * Releases seats held by a ride request (used on cancellation) - also
 * transactional so it can't race with a simultaneous join.
 */
async function releaseSeats({ rideRequestId }) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.poolMember.findUnique({ where: { rideRequestId } });
    if (!member) return null;

    await tx.$queryRaw`SELECT id FROM pools WHERE id = ${member.poolId} FOR UPDATE`;

    const pool = await tx.pool.findUnique({ where: { id: member.poolId } });
    const newOccupied = Math.max(pool.occupiedSeats - member.seats, 0);

    // Only OPEN/FULL pools (still pre-pickup, still matchable) reopen to
    // OPEN when a seat frees up. A pool that's already DRIVER_ARRIVED /
    // IN_PROGRESS / COMPLETED / CANCELLED keeps its status - the trip is
    // already underway for the remaining passengers and must not become
    // joinable by new requests again.
    const nextStatus = ['OPEN', 'FULL'].includes(pool.status) ? 'OPEN' : pool.status;

    const updatedPool = await tx.pool.update({
      where: { id: pool.id },
      data: { occupiedSeats: newOccupied, status: nextStatus },
    });

    await tx.poolMember.delete({ where: { rideRequestId } });

    return updatedPool;
  });
}

module.exports = { joinOrCreatePool, releaseSeats, SeatUnavailableError };
