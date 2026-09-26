const { calculateFarePaisa, BASE_FARE_PAISA, PER_ZONE_HOP_PAISA, POOL_DISCOUNT_PAISA } = require('../src/services/fare.service');

// Test 3 (spec): Nusrat and Rafiq's fares are calculated correctly.
describe('Fare calculation (integer paisa)', () => {
  test('solo ride (no pool discount) charges base + distance only', () => {
    const fare = calculateFarePaisa({
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      seats: 1,
      isPooled: false,
    });
    expect(fare).toBe(BASE_FARE_PAISA + PER_ZONE_HOP_PAISA * 1);
  });

  test('pooled ride applies the per-seat pool discount', () => {
    // Nusrat: Banani -> Mohakhali, pooled with Rafiq
    const nusratFare = calculateFarePaisa({
      pickupZone: 'BANANI',
      destinationZone: 'MOHAKHALI',
      seats: 1,
      isPooled: true,
    });
    // Rafiq: Banani -> Gulshan 1, pooled with Nusrat
    const rafiqFare = calculateFarePaisa({
      pickupZone: 'BANANI',
      destinationZone: 'GULSHAN_1',
      seats: 1,
      isPooled: true,
    });

    expect(nusratFare).toBe(BASE_FARE_PAISA + PER_ZONE_HOP_PAISA - POOL_DISCOUNT_PAISA);
    expect(rafiqFare).toBe(BASE_FARE_PAISA + PER_ZONE_HOP_PAISA - POOL_DISCOUNT_PAISA);
    // Same cluster, same hop-count -> identical fare, and strictly less
    // than the solo fare because of the pool discount.
    expect(nusratFare).toBe(rafiqFare);
    expect(nusratFare).toBeLessThan(
      calculateFarePaisa({ pickupZone: 'BANANI', destinationZone: 'MOHAKHALI', seats: 1, isPooled: false })
    );
  });

  test('fare scales linearly with seats requested', () => {
    const oneSeat = calculateFarePaisa({ pickupZone: 'MIRPUR', destinationZone: 'UTTARA', seats: 1, isPooled: false });
    const threeSeats = calculateFarePaisa({ pickupZone: 'MIRPUR', destinationZone: 'UTTARA', seats: 3, isPooled: false });
    expect(threeSeats).toBe(oneSeat * 3);
  });

  test('fare is always a non-negative integer (never float, never negative)', () => {
    const fare = calculateFarePaisa({ pickupZone: 'DHANMONDI', destinationZone: 'BASHUNDHARA', seats: 1, isPooled: true });
    expect(Number.isInteger(fare)).toBe(true);
    expect(fare).toBeGreaterThanOrEqual(0);
  });
});
