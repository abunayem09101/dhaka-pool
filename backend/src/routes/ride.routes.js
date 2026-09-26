const express = require('express');
const prisma = require('../db/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const { assertTransitionAllowed } = require('../utils/stateMachine');
const { ZONES, isValidZone } = require('../services/location.service');
const { calculateFarePaisa } = require('../services/fare.service');
const { releaseSeats } = require('../services/matching.service');

const router = express.Router();

// Public-ish (still requires login) list of predefined zones for the
// pickup/destination dropdowns on the frontend.
router.get('/locations', requireAuth, (req, res) => {
  res.json(
    Object.entries(ZONES).map(([key, z]) => ({ key, ...z }))
  );
});

// --- Create a ride request (passenger only) -------------------------
router.post('/rides', requireAuth, requireRole('PASSENGER'), async (req, res, next) => {
  try {
    const { pickupZone, destinationZone, seatsRequested } = req.body;
    const seats = Number(seatsRequested);

    if (!isValidZone(pickupZone) || !isValidZone(destinationZone)) {
      return res.status(400).json({ error: 'pickupZone/destinationZone must be one of the predefined zones' });
    }
    if (pickupZone === destinationZone) {
      return res.status(400).json({ error: 'pickup and destination cannot be the same zone' });
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 3) {
      return res.status(400).json({ error: 'seatsRequested must be an integer between 1 and 3' });
    }

    // Estimate assumes no pooling yet (worst case for the passenger);
    // the REAL fare is finalized once a driver accepts and the ride is
    // actually seated into a pool (see driver.routes.js accept handler).
    const estimatedFarePaisa = calculateFarePaisa({ pickupZone, destinationZone, seats, isPooled: false });

    const ride = await prisma.rideRequest.create({
      data: {
        passengerId: req.user.id,
        pickupZone,
        destinationZone,
        seatsRequested: seats,
        estimatedFarePaisa,
        status: 'REQUESTED',
      },
    });

    await prisma.rideStatusHistory.create({
      data: { rideRequestId: ride.id, fromStatus: null, toStatus: 'REQUESTED', note: 'Ride requested by passenger' },
    });

    res.status(201).json(ride);
  } catch (err) {
    next(err);
  }
});

// --- Passenger's own ride history ------------------------------------
router.get('/rides/mine', requireAuth, requireRole('PASSENGER'), async (req, res, next) => {
  try {
    const rides = await prisma.rideRequest.findMany({
      where: { passengerId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { poolMember: { include: { pool: { include: { vehicle: { include: { driver: true } } } } } } },
    });
    res.json(rides);
  } catch (err) {
    next(err);
  }
});

// --- Single ride detail + status (ownership enforced) -----------------
router.get('/rides/:id', requireAuth, async (req, res, next) => {
  try {
    const ride = await prisma.rideRequest.findUnique({
      where: { id: req.params.id },
      include: {
        statusHistory: { orderBy: { changedAt: 'asc' } },
        poolMember: { include: { pool: { include: { vehicle: { include: { driver: true } } } } } },
      },
    });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    // Ownership: a passenger may only view their own ride. A driver may
    // only view rides that are part of one of their vehicle's pools.
    if (req.user.role === 'PASSENGER' && ride.passengerId !== req.user.id) {
      return res.status(403).json({ error: 'You do not have access to this ride' });
    }
    if (req.user.role === 'DRIVER') {
      const driverOwnsIt = ride.poolMember?.pool?.vehicle?.driverId === req.user.id;
      if (!driverOwnsIt) return res.status(403).json({ error: 'You do not have access to this ride' });
    }

    res.json(ride);
  } catch (err) {
    next(err);
  }
});

// --- Cancel a ride (passenger, ownership + valid-state enforced) ------
router.post('/rides/:id/cancel', requireAuth, requireRole('PASSENGER'), async (req, res, next) => {
  try {
    const ride = await prisma.rideRequest.findUnique({ where: { id: req.params.id } });
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.passengerId !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own ride' });
    }

    assertTransitionAllowed(ride.status, 'CANCELLED');

    await releaseSeats({ rideRequestId: ride.id });

    const updated = await prisma.rideRequest.update({
      where: { id: ride.id },
      data: { status: 'CANCELLED' },
    });
    await prisma.rideStatusHistory.create({
      data: { rideRequestId: ride.id, fromStatus: ride.status, toStatus: 'CANCELLED', note: 'Cancelled by passenger' },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
