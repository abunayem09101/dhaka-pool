const { PrismaClient } = require('@prisma/client');

// A single shared Prisma client for the whole process (Prisma's own
// recommendation - avoids exhausting DB connections in dev with
// hot-reload, and keeps one connection pool in production).
const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
