const { prisma, resetDb, makeUser, makeDriverWithVehicle } = require('./helpers/testSetup');
const { joinOrCreatePool, SeatUnavailableError } = require('../src/services/matching.service');

async function makeRideRequest(passenger, { pickupZone, destinationZone, seatsRequested }) {
  return prisma.rideRequest.create({
    data: {
      passengerId: passenger.id,
      pickupZone,
      destinationZone,
      seatsRequested,
      estimatedFarePaisa: 0,
      status: 'REQUESTED',
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Pooling capacity enforcement', () => {
  // Test 1 (spec): Bullet's capacity (3) is never exceeded.
  test('rejects a request that would push occupied seats past vehicle capacity', async () => {
    const { vehicle } = await makeDriverWithVehicle({ name: 'Jashim', email: 'jashim@t.com', capacity: 3 });
    const nusrat = await makeUser({ name: 'Nusrat', email: 'nusrat@t.com', role: 'PASSENGER' });
    const rafiq = await makeUser({ name: 'Rafiq', email: 'rafiq@t.com', role: 'PASSENGER' });
    const shirin = await makeUser({ name: 'Shirin', email: 'shirin@t.com', role: 'PASSENGER' });
    const fourth = await makeUser({ name: 'Karim', email: 'karim@t.com', role: 'PASSENGER' });

    const r1 = await makeRideRequest(nusrat, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });
    const r2 = await makeRideRequest(rafiq, { pickupZone: 'BANANI', destinationZone: 'GULSHAN_1', seatsRequested: 1 });
    const r3 = await makeRideRequest(shirin, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });
    const r4 = await makeRideRequest(fourth, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });

    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: r1.id, pickupZone: r1.pickupZone, destinationZone: r1.destinationZone, seatsRequested: 1 });
    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: r2.id, pickupZone: r2.pickupZone, destinationZone: r2.destinationZone, seatsRequested: 1 });
    const afterThird = await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: r3.id, pickupZone: r3.pickupZone, destinationZone: r3.destinationZone, seatsRequested: 1 });

    expect(afterThird.pool.occupiedSeats).toBe(3);
    expect(afterThird.pool.status).toBe('FULL');

    // 3 + 1 = 4 seats > capacity 3 -> must be rejected.
    await expect(
      joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: r4.id, pickupZone: r4.pickupZone, destinationZone: r4.destinationZone, seatsRequested: 1 })
    ).rejects.toThrow(SeatUnavailableError);

    const pool = await prisma.pool.findFirst({ where: { vehicleId: vehicle.id } });
    expect(pool.occupiedSeats).toBe(3); // still exactly 3, never 4
  });

  test('a route-incompatible request opens a separate pool instead of overfilling the first', async () => {
    const { vehicle } = await makeDriverWithVehicle({ name: 'Jashim', email: 'jashim2@t.com', capacity: 3 });
    const a = await makeUser({ name: 'A', email: 'a@t.com', role: 'PASSENGER' });
    const b = await makeUser({ name: 'B', email: 'b@t.com', role: 'PASSENGER' });

    const rideA = await makeRideRequest(a, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });
    // Mirpur -> Uttara is a totally different cluster than Banani -> Mohakhali.
    const rideB = await makeRideRequest(b, { pickupZone: 'MIRPUR', destinationZone: 'UTTARA', seatsRequested: 1 });

    const resultA = await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: rideA.id, pickupZone: rideA.pickupZone, destinationZone: rideA.destinationZone, seatsRequested: 1 });
    const resultB = await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: rideB.id, pickupZone: rideB.pickupZone, destinationZone: rideB.destinationZone, seatsRequested: 1 });

    expect(resultA.pool.id).not.toBe(resultB.pool.id);
  });

  // Test 6 (spec): two simultaneous requests for the last seat must not both succeed.
  test('concurrent claims for the last seat never oversell the vehicle', async () => {
    const { vehicle } = await makeDriverWithVehicle({ name: 'Jashim', email: 'jashim3@t.com', capacity: 3 });
    const nusrat = await makeUser({ name: 'Nusrat', email: 'nusrat3@t.com', role: 'PASSENGER' });
    const rafiq = await makeUser({ name: 'Rafiq', email: 'rafiq3@t.com', role: 'PASSENGER' });
    const shirin = await makeUser({ name: 'Shirin', email: 'shirin3@t.com', role: 'PASSENGER' });

    const r1 = await makeRideRequest(nusrat, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });
    const r2 = await makeRideRequest(rafiq, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });
    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: r1.id, pickupZone: r1.pickupZone, destinationZone: r1.destinationZone, seatsRequested: 1 });
    await joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: r2.id, pickupZone: r2.pickupZone, destinationZone: r2.destinationZone, seatsRequested: 1 });
    // 2/3 seats now occupied - exactly 1 seat left.

    const shirinRide = await makeRideRequest(shirin, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });
    const anotherPassenger = await makeUser({ name: 'Karim', email: 'karim3@t.com', role: 'PASSENGER' });
    const karimRide = await makeRideRequest(anotherPassenger, { pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seatsRequested: 1 });

    // Fire both claims for the single remaining seat at the same time.
    const results = await Promise.allSettled([
      joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: shirinRide.id, pickupZone: shirinRide.pickupZone, destinationZone: shirinRide.destinationZone, seatsRequested: 1 }),
      joinOrCreatePool({ vehicleId: vehicle.id, rideRequestId: karimRide.id, pickupZone: karimRide.pickupZone, destinationZone: karimRide.destinationZone, seatsRequested: 1 }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one of the two simultaneous claims must win.
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    const pool = await prisma.pool.findFirst({ where: { vehicleId: vehicle.id } });
    expect(pool.occupiedSeats).toBe(3); // never 4
    expect(pool.status).toBe('FULL');
  });
});
