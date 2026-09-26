FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

RUN npx prisma generate

EXPOSE 4000

# Applies migrations, seeds the demo data, then starts the API. Safe to
# re-run: migrate deploy is idempotent and the seed script upserts users.
CMD sh -c "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"
