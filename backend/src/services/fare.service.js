// =====================================================================
// Fare calculation.
//
// All money is stored and calculated as INTEGER PAISA (1 taka = 100
// paisa), never as a float. Floats lose precision on money math
// (0.1 + 0.2 !== 0.3), and paisa-as-integer sidesteps that entirely.
// Convert to taka only when displaying to a human.
// =====================================================================

const BASE_FARE_PAISA = 5000; // ৳50 flat base fare
const PER_ZONE_HOP_PAISA = 1500; // distance charge per zone "hop" away
const POOL_DISCOUNT_PAISA = 1000; // ৳10 off per passenger when pooled

const { clusterOf } = require('./location.service');

// A tiny, explainable stand-in for a real distance calculation: zones in
// the same cluster are "1 hop", otherwise "2 hops". This keeps geography
// simple per the spec while still making fare depend on distance.
function hopsBetween(pickupZone, destinationZone) {
  if (pickupZone === destinationZone) return 1;
  const cluster = clusterOf(pickupZone);
  return cluster.includes(destinationZone) ? 1 : 2;
}

/**
 * @param {Object} params
 * @param {string} params.pickupZone
 * @param {string} params.destinationZone
 * @param {number} params.seats - seats this passenger is booking
 * @param {boolean} params.isPooled - true if riding with >=1 other passenger
 * @returns {number} fare in paisa (integer, always >= 0)
 */
function calculateFarePaisa({ pickupZone, destinationZone, seats, isPooled }) {
  const distanceCharge = hopsBetween(pickupZone, destinationZone) * PER_ZONE_HOP_PAISA;
  const subtotal = (BASE_FARE_PAISA + distanceCharge) * seats;
  const discount = isPooled ? POOL_DISCOUNT_PAISA * seats : 0;
  const fare = subtotal - discount;
  return Math.max(fare, 0);
}

function paisaToTakaDisplay(paisa) {
  return `৳${(paisa / 100).toFixed(2)}`;
}

module.exports = {
  BASE_FARE_PAISA,
  PER_ZONE_HOP_PAISA,
  POOL_DISCOUNT_PAISA,
  hopsBetween,
  calculateFarePaisa,
  paisaToTakaDisplay,
};
