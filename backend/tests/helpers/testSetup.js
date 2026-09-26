// Integration test helper. These tests need a REAL Postgres database
// (they exercise Prisma transactions + row locking, which cannot be
// faithfully mocked). Point DATABASE_URL at a throwaway test database
// before running, e.g.:
//
//   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dhaka_pool_test \
//     npx prisma migrate deploy && npx jest tests/pool.test.js
//
// docker-compose.yml documents the equivalent one-command flow.

const prisma = require('../../src/db/prisma');
const createApp = require('../../src/app');
const { signToken } = require('../../src/middleware/auth');
const bcrypt = require('bcryptjs');

const app = createApp();

async function resetDb() {
  // Order matters because of foreign keys - children first.
  await prisma.rideStatusHistory.deleteMany();
  await prisma.poolMember.deleteMany();
  await prisma.pool.deleteMany();
  await prisma.rideRequest.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
}

async function makeUser({ name, email, role }) {
  const passwordHash = await bcrypt.hash('password123', 4);
  return prisma.user.create({ data: { name, email, passwordHash, role } });
}

async function makeDriverWithVehicle({ name, email, capacity }) {
  const driver = await makeUser({ name, email, role: 'DRIVER' });
  const vehicle = await prisma.vehicle.create({
    data: { driverId: driver.id, name: 'Bullet', model: 'Tesla', capacity, isOnline: true },
  });
  return { driver, vehicle };
}

function authHeader(user) {
  return { Authorization: `Bearer ${signToken(user)}` };
}

module.exports = { app, prisma, resetDb, makeUser, makeDriverWithVehicle, authHeader };
