FROM node:20-slim

WORKDIR /app

# node:20-alpine (musl libc) doesn't ship a libssl Prisma's query engine
# can detect, and it fails at runtime with an opaque
# "Could not parse schema engine response" error - this was actually
# hit in development (see README AI Usage section). node:20-slim
# (Debian) + an explicit openssl install fixes it.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

RUN npx prisma generate

EXPOSE 4000

# Applies migrations, seeds the demo data, then starts the API. Safe to
# re-run: migrate deploy is idempotent and the seed script upserts users.
CMD sh -c "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"
