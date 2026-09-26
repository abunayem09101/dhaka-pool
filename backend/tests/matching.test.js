const { isPoolCompatible, isValidZone } = require('../src/services/location.service');

describe('Zone compatibility rule (pooling matcher)', () => {
  test("Nusrat (Banani->Mohakhali) and Rafiq (Banani->Gulshan 1) are compatible", () => {
    const compatible = isPoolCompatible(
      { pickupZone: 'BANANI', destinationZone: 'GULSHAN_1' },
      { poolPickupZone: 'BANANI', poolDestinationZone: 'MOHAKHALI' }
    );
    expect(compatible).toBe(true);
  });

  test('completely different clusters are not compatible', () => {
    const compatible = isPoolCompatible(
      { pickupZone: 'MIRPUR', destinationZone: 'UTTARA' },
      { poolPickupZone: 'BANANI', poolDestinationZone: 'MOHAKHALI' }
    );
    expect(compatible).toBe(false);
  });

  test('same pickup but incompatible destination cluster is rejected', () => {
    const compatible = isPoolCompatible(
      { pickupZone: 'BANANI', destinationZone: 'MIRPUR' },
      { poolPickupZone: 'BANANI', poolDestinationZone: 'MOHAKHALI' }
    );
    expect(compatible).toBe(false);
  });

  test('validates known vs unknown zone keys', () => {
    expect(isValidZone('BANANI')).toBe(true);
    expect(isValidZone('GULSHAN_2')).toBe(false);
  });
});
