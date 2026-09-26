const request = require('supertest');
const { app, prisma, resetDb, makeUser, authHeader } = require('./helpers/testSetup');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Test 4 (spec): Nusrat cannot modify Rafiq's ride.
describe('Ownership enforcement', () => {
  test("a passenger cannot cancel another passenger's ride", async () => {
    const nusrat = await makeUser({ name: 'Nusrat', email: 'nusrat@own.com', role: 'PASSENGER' });
    const rafiq = await makeUser({ name: 'Rafiq', email: 'rafiq@own.com', role: 'PASSENGER' });

    const rafiqRide = await prisma.rideRequest.create({
      data: {
        passengerId: rafiq.id,
        pickupZone: 'BANANI',
        destinationZone: 'GULSHAN_1',
        seatsRequested: 1,
        estimatedFarePaisa: 6500,
        status: 'REQUESTED',
      },
    });

    const res = await request(app)
      .post(`/api/rides/${rafiqRide.id}/cancel`)
      .set(authHeader(nusrat));

    expect(res.status).toBe(403);

    const stillThere = await prisma.rideRequest.findUnique({ where: { id: rafiqRide.id } });
    expect(stillThere.status).toBe('REQUESTED'); // untouched
  });

  test("a passenger cannot view another passenger's ride detail", async () => {
    const nusrat = await makeUser({ name: 'Nusrat', email: 'nusrat2@own.com', role: 'PASSENGER' });
    const rafiq = await makeUser({ name: 'Rafiq', email: 'rafiq2@own.com', role: 'PASSENGER' });

    const rafiqRide = await prisma.rideRequest.create({
      data: {
        passengerId: rafiq.id,
        pickupZone: 'BANANI',
        destinationZone: 'GULSHAN_1',
        seatsRequested: 1,
        estimatedFarePaisa: 6500,
        status: 'REQUESTED',
      },
    });

    const res = await request(app).get(`/api/rides/${rafiqRide.id}`).set(authHeader(nusrat));
    expect(res.status).toBe(403);
  });

  test('an unauthenticated request is rejected', async () => {
    const res = await request(app).get('/api/rides/mine');
    expect(res.status).toBe(401);
  });
});
