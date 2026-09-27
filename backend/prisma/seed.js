// Seed data uses the actual people from the challenge story, not
// generic user1/driver1 placeholders, per the assignment's instruction.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'password123';

async function upsertUser({ name, email, role, walletBalancePaisa }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role, ...(walletBalancePaisa !== undefined ? { walletBalancePaisa } : {}) },
  });
}

async function main() {
  const jashim = await upsertUser({ name: 'Jashim', email: 'jashim@dhakapool.demo', role: 'DRIVER' });
  const nusrat = await upsertUser({ name: 'Nusrat', email: 'nusrat@dhakapool.demo', role: 'PASSENGER', walletBalancePaisa: 50000 }); // ৳500
  const rafiq = await upsertUser({ name: 'Rafiq', email: 'rafiq@dhakapool.demo', role: 'PASSENGER', walletBalancePaisa: 50000 }); // ৳500
  // Shirin is seeded with a deliberately low TeslaPay balance so the
  // "insufficient wallet balance at trip completion" edge case is easy
  // to demo: she'll show PAID via CASH fine, but FAILED if she picks
  // TESLAPAY for a fare that exceeds ৳5.
  const shirin = await upsertUser({ name: 'Shirin', email: 'shirin@dhakapool.demo', role: 'PASSENGER', walletBalancePaisa: 500 }); // ৳5

  const existingVehicle = await prisma.vehicle.findFirst({ where: { driverId: jashim.id } });
  const bullet =
    existingVehicle ||
    (await prisma.vehicle.create({
      data: {
        driverId: jashim.id,
        name: 'Bullet',
        model: 'Tesla',
        capacity: 3,
        isOnline: true,
      },
    }));

  // eslint-disable-next-line no-console
  console.log('Seeded:');
  console.log({ jashim: jashim.email, nusrat: nusrat.email, rafiq: rafiq.email, shirin: shirin.email });
  console.log({ vehicle: `${bullet.model} ${bullet.name}`, capacity: bullet.capacity, id: bullet.id });
  console.log('Wallet balances: Nusrat ৳500, Rafiq ৳500, Shirin ৳5 (intentionally low - demos a FAILED TeslaPay payment)');
  console.log(`All demo accounts share the password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
