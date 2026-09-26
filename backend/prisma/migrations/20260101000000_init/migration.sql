-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PASSENGER', 'DRIVER');
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'FULL', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vehicles_capacity_positive" CHECK ("capacity" > 0)
);

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "occupiedSeats" INTEGER NOT NULL DEFAULT 0,
    "pickupZone" TEXT NOT NULL,
    "destinationZone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pools_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pools_occupied_seats_nonnegative" CHECK ("occupiedSeats" >= 0)
);

-- CreateTable
CREATE TABLE "pool_members" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "rideRequestId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "farePaisa" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pool_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pool_members_seats_positive" CHECK ("seats" > 0)
);
CREATE UNIQUE INDEX "pool_members_rideRequestId_key" ON "pool_members"("rideRequestId");

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "pickupZone" TEXT NOT NULL,
    "destinationZone" TEXT NOT NULL,
    "seatsRequested" INTEGER NOT NULL,
    "estimatedFarePaisa" INTEGER NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ride_requests_seats_range" CHECK ("seatsRequested" > 0 AND "seatsRequested" <= 3)
);

-- CreateTable
CREATE TABLE "ride_status_history" (
    "id" TEXT NOT NULL,
    "rideRequestId" TEXT NOT NULL,
    "fromStatus" "RideStatus",
    "toStatus" "RideStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "ride_status_history_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pools" ADD CONSTRAINT "pools_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pool_members" ADD CONSTRAINT "pool_members_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ride_status_history" ADD CONSTRAINT "ride_status_history_rideRequestId_fkey" FOREIGN KEY ("rideRequestId") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- Defense-in-depth: a trigger that re-checks "occupied seats can never
-- exceed the vehicle's capacity" directly in the database, independent
-- of the application's transactional locking in matching.service.js.
-- A plain CHECK constraint can't reference another table, so a trigger
-- is the standard Postgres way to enforce a cross-table invariant.
-- =====================================================================
CREATE OR REPLACE FUNCTION enforce_pool_capacity() RETURNS TRIGGER AS $$
DECLARE
  vehicle_capacity INTEGER;
BEGIN
  SELECT "capacity" INTO vehicle_capacity FROM "vehicles" WHERE "id" = NEW."vehicleId";
  IF NEW."occupiedSeats" > vehicle_capacity THEN
    RAISE EXCEPTION 'occupiedSeats (%) exceeds vehicle capacity (%) for vehicle %',
      NEW."occupiedSeats", vehicle_capacity, NEW."vehicleId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_pool_capacity
  BEFORE INSERT OR UPDATE ON "pools"
  FOR EACH ROW EXECUTE FUNCTION enforce_pool_capacity();
