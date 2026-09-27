const express = require('express');
const prisma = require('../db/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { assertTransitionAllowed } = require('../utils/stateMachine');
const { isPoolCompatible } = require('../services/location.service');
const { joinOrCreatePool, SeatUnavailableError } = require('../services/matching.service');
const { settlePayment } = require('../services/payment.service');

const router = express.Router();
router.use(requireAuth, requireRole('DRIVER'));

async function getOwnVehicle(driverId) {
  const vehicle = await prisma.vehicle.findFirst({ where: { driverId } });
  if (!vehicle) {
    const err = new Error('You have no vehicle registered');
    err.statusCode = 400;
    throw err;
  }
  return vehicle;
}

// --- Go online / offline ----------------------------------------------
router.post('/online', async (req, res, next) => {
  try {
    const { online } = req.body; // boolean
    const vehicle = await getOwnVehicle(req.user.id);
    const updated = await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { isOnline: Boolean(online) },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// --- Available ride requests this driver could take --------------------
// "Available" = status REQUESTED, not already seated, and either there
// is no open pool yet for this vehicle (any first request is fair game)
// or the request is route-compatible with the vehicle's current open pool.
router.get('/requests', async (req, res, next) => {
  try {
    const vehicle = await getOwnVehicle(req.user.id);
    if (!vehicle.isOnline) return res.json([]);

    const openPool = await prisma.pool.findFirst({
      where: { vehicleId: vehicle.id, status: 'OPEN' },
    });

    const candidates = await prisma.rideRequest.findMany({
      where: { status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
      include: { passenger: true },
    });

    const seatsLeft = openPool ? vehicle.capacity - openPool.occupiedSeats : vehicle.capacity;

    const available = candidates.filter((r) => {
      if (r.seatsRequested > seatsLeft) return false;
      if (!openPool) return true;
      return isPoolCompatible(
        { pickupZone: r.pickupZone, destinationZone: r.destinationZone },
        { poolPickupZone: openPool.pickupZone, poolDestinationZone: openPool.destinationZone }
      );
    });

    res.json(available);
  } catch (err) {
    next(err);
  }
});

// --- Accept a ride request (seats it into a pool, concurrency-safe) ----
router.post('/requests/:rideRequestId/accept', async (req, res, next) => {
  try {
    const vehicle = await getOwnVehicle(req.user.id);
    const ride = await prisma.rideRequest.findUnique({ where: { id: req.params.rideRequestId } });
    if (!ride) return res.status(404).json({ error: 'Ride request not found' });

    assertTransitionAllowed(ride.status, 'ACCEPTED');

    let seatResult;
    try {
      seatResult = await joinOrCreatePool({
        vehicleId: vehicle.id,
        rideRequestId: ride.id,
        pickupZone: ride.pickupZone,
        destinationZone: ride.destinationZone,
        seatsRequested: ride.seatsRequested,
      });
    } catch (e) {
      if (e instanceof SeatUnavailableError) {
        return res.status(409).json({ error: e.message });
      }
      throw e;
    }

    const updated = await prisma.rideRequest.update({
      where: { id: ride.id },
      data: { status: 'ACCEPTED', estimatedFarePaisa: seatResult.farePaisa },
    });
    await prisma.rideStatusHistory.create({
      data: { rideRequestId: ride.id, fromStatus: 'REQUESTED', toStatus: 'ACCEPTED', note: `Accepted by driver into pool ${seatResult.pool.id}` },
    });

    res.json({ ride: updated, pool: seatResult.pool, farePaisa: seatResult.farePaisa });
  } catch (err) {
    next(err);
  }
});

// --- Current pool (who's assigned right now) ---------------------------
router.get('/pools/current', async (req, res, next) => {
  try {
    const vehicle = await getOwnVehicle(req.user.id);
    const pool = await prisma.pool.findFirst({
      where: { vehicleId: vehicle.id, status: { in: ['OPEN', 'FULL', 'DRIVER_ARRIVED', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
      include: { members: { include: { rideRequest: { include: { passenger: true } } } } },
    });
    res.json(pool || null);
  } catch (err) {
    next(err);
  }
});

// Shared helper: transition every ride request in a pool together, and
// move the pool itself to the matching pool-status.
async function transitionPool({ driverId, poolId, toRideStatus, toPoolStatus, note }) {
  const pool = await prisma.pool.findUnique({
    where: { id: poolId },
    include: { vehicle: true, members: { include: { rideRequest: true } } },
  });
  if (!pool) {
    const err = new Error('Pool not found');
    err.statusCode = 404;
    throw err;
  }
  if (pool.vehicle.driverId !== driverId) {
    const err = new Error('This pool does not belong to your vehicle');
    err.statusCode = 403;
    throw err;
  }

  // Validate + apply the transition for every member ride first (fail
  // fast before writing anything if any member is in an unexpected state).
  for (const member of pool.members) {
    assertTransitionAllowed(member.rideRequest.status, toRideStatus);
  }

  // Interactive transaction (not the array form) because reaching
  // COMPLETED also needs to settle payment per member using the same
  // `tx` client - wallet debit and status change must be atomic.
  await prisma.$transaction(async (tx) => {
    for (const m of pool.members) {
      await tx.rideRequest.update({ where: { id: m.rideRequestId }, data: { status: toRideStatus } });
      await tx.rideStatusHistory.create({
        data: { rideRequestId: m.rideRequestId, fromStatus: m.rideRequest.status, toStatus: toRideStatus, note },
      });

      if (toRideStatus === 'COMPLETED') {
        await settlePayment(tx, {
          rideRequestId: m.rideRequestId,
          passengerId: m.rideRequest.passengerId,
          method: m.rideRequest.paymentMethod,
          farePaisa: m.farePaisa,
        });
      }
    }
    await tx.pool.update({ where: { id: pool.id }, data: { status: toPoolStatus } });
  });

  return prisma.pool.findUnique({
    where: { id: pool.id },
    include: { members: { include: { rideRequest: { include: { passenger: true } } } } },
  });
}

router.post('/pools/:poolId/arrived', async (req, res, next) => {
  try {
    const pool = await transitionPool({
      driverId: req.user.id,
      poolId: req.params.poolId,
      toRideStatus: 'DRIVER_ARRIVED',
      toPoolStatus: 'DRIVER_ARRIVED',
      note: 'Driver marked arrived',
    });
    res.json(pool);
  } catch (err) {
    next(err);
  }
});

router.post('/pools/:poolId/start', async (req, res, next) => {
  try {
    const pool = await transitionPool({
      driverId: req.user.id,
      poolId: req.params.poolId,
      toRideStatus: 'STARTED',
      toPoolStatus: 'IN_PROGRESS',
      note: 'Trip started',
    });
    res.json(pool);
  } catch (err) {
    next(err);
  }
});

router.post('/pools/:poolId/complete', async (req, res, next) => {
  try {
    const pool = await transitionPool({
      driverId: req.user.id,
      poolId: req.params.poolId,
      toRideStatus: 'COMPLETED',
      toPoolStatus: 'COMPLETED',
      note: 'Trip completed',
    });
    res.json(pool);
  } catch (err) {
    next(err);
  }
});

// --- Driver's own ride/pool history --------------------------------------
router.get('/history', async (req, res, next) => {
  try {
    const vehicle = await getOwnVehicle(req.user.id);
    const pools = await prisma.pool.findMany({
      where: { vehicleId: vehicle.id, status: { in: ['COMPLETED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' },
      include: { members: { include: { rideRequest: { include: { passenger: true } } } } },
    });
    res.json(pools);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
