const { prisma, resetDb, makeUser, makeDriverWithVehicle } = require('./helpers/testSetup');
const { joinOrCreatePool, releaseSeats } = require('../src/services/matching.service');
const { assertTransitionAllowed, InvalidTransitionError } = require('../src/utils/stateMachine');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Test 5 (spec): cancellation rules work correctly.
describe('Cancellation rules', () => {
  test('cancelling a REQUESTED ride requires no seat release and is allowed', () => {
    expect(() => assertTransitionAllowed('REQUESTED', 'CANCELLED')).not.toThrow();
  });

  test('cancelling a STARTED ride is rejected (trip already underway)', () => {
    expect(() => assertTransitionAllowed('STARTED', 'CANCELLED')).toThrow(InvalidTransitionError);
  });

  test('cancelling an ACCEPTED ride frees its seat back to the pool', async () => {
    const { vehicle } = await makeDriverWithVehicle({ name: 'Jashim', email: 'jashim@cancel.com', capacity: 3 });
    const nusrat = await makeUser({ name: 'Nusrat', email: 'nusrat@cancel.com', role: 'PASSENGER' });
    const rafiq = await makeUser({ name: 'Rafiq', email: 'rafiq@cancel.com', role: 'PASSENGER' });

    const nusratRide = await prisma.rideRequest.create({
      data: { passengerId: nusrat.id, pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1, estimatedFarePaisa: 0, status: 'REQUESTED' },
    });
    const rafiqRide = await prisma.rideRequest.create({
      data: { passengerId: rafiq.id, pickupZone: 'BANANI', destinationZone: 'GULSHAN_1', seatsRequested: 1, estimatedFarePaisa: 0, status: 'REQUESTED' },
    });

    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: nusratRide.id, pickupZone: nusratRide.pickupZone, destinationZone: nusratRide.destinationZone, seatsRequested: 1 });
    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: rafiqRide.id, pickupZone: rafiqRide.pickupZone, destinationZone: rafiqRide.destinationZone, seatsRequested: 1 });

    let pool = await prisma.pool.findFirst({ where: { vehicleId: vehicle.id } });
    expect(pool.occupiedSeats).toBe(2);

    // Nusrat cancels -> her seat should be released, Rafiq's stays intact.
    await prisma.rideRequest.update({ where: { id: nusratRide.id }, data: { status: 'CANCELLED' } });
    await releaseSeats({ rideRequestId: nusratRide.id });

    pool = await prisma.pool.findFirst({ where: { vehicleId: vehicle.id } });
    expect(pool.occupiedSeats).toBe(1);
    expect(pool.status).toBe('OPEN'); // reopened since it now has a free seat

    const rafiqStillMember = await prisma.poolMember.findUnique({ where: { rideRequestId: rafiqRide.id } });
    expect(rafiqStillMember).not.toBeNull();

    const nusratMemberGone = await prisma.poolMember.findUnique({ where: { rideRequestId: nusratRide.id } });
    expect(nusratMemberGone).toBeNull();
  });

  test('a freed seat can be claimed by a new passenger afterwards', async () => {
    const { vehicle } = await makeDriverWithVehicle({ name: 'Jashim', email: 'jashim2@cancel.com', capacity: 1 });
    const nusrat = await makeUser({ name: 'Nusrat', email: 'nusrat2@cancel.com', role: 'PASSENGER' });
    const shirin = await makeUser({ name: 'Shirin', email: 'shirin2@cancel.com', role: 'PASSENGER' });

    const nusratRide = await prisma.rideRequest.create({
      data: { passengerId: nusrat.id, pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1, estimatedFarePaisa: 0, status: 'REQUESTED' },
    });
    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: nusratRide.id, pickupZone: nusratRide.pickupZone, destinationZone: nusratRide.destinationZone, seatsRequested: 1 });

    await releaseSeats({ rideRequestId: nusratRide.id });

    const shirinRide = await prisma.rideRequest.create({
      data: { passengerId: shirin.id, pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1, estimatedFarePaisa: 0, status: 'REQUESTED' },
    });

    const result = await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: shirinRide.id, pickupZone: shirinRide.pickupZone, destinationZone: shirinRide.destinationZone, seatsRequested: 1 });
    expect(result.pool.occupiedSeats).toBe(1);
  });
});
