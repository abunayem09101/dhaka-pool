// =====================================================================
// Location / zone data + the pooling compatibility rule.
//
// We deliberately do NOT do real map routing. Instead we use a fixed
// list of Dhaka zones (with lat/lng kept only for display) and a small
// number of hand-picked "clusters" - groups of zones that are close
// enough together that a shared ride between them makes sense.
//
// THE RULE (also documented in README.md "Design decisions"):
//   Two ride requests are POOL-COMPATIBLE if and only if:
//     1. Their pickup zones are the same zone, OR both fall in the same
//        pickup cluster, AND
//     2. Their destination zones are the same zone, OR both fall in the
//        same destination cluster.
//
// This is intentionally simple and 100% deterministic so it can be
// explained and defended in an interview, and so tests are exact.
// =====================================================================

const ZONES = {
  BANANI: { name: 'Banani', lat: 23.7937, lng: 90.4066 },
  GULSHAN_1: { name: 'Gulshan 1', lat: 23.7806, lng: 90.4169 },
  MOHAKHALI: { name: 'Mohakhali', lat: 23.7808, lng: 90.4071 },
  DHANMONDI: { name: 'Dhanmondi', lat: 23.7461, lng: 90.3742 },
  MIRPUR: { name: 'Mirpur', lat: 23.8223, lng: 90.3654 },
  UTTARA: { name: 'Uttara', lat: 23.8759, lng: 90.3795 },
  FARMGATE: { name: 'Farmgate', lat: 23.7581, lng: 90.3898 },
  BASHUNDHARA: { name: 'Bashundhara', lat: 23.8149, lng: 90.4353 },
};

// Clusters: zones inside the same cluster are considered "close enough"
// to share a ride. A zone that is not listed here is its own cluster
// of one (i.e. only exact-same-zone pickups pool with it).
const CLUSTERS = [
  ['BANANI', 'GULSHAN_1', 'MOHAKHALI'], // matches the spec's worked example
  ['MIRPUR', 'UTTARA'],
  ['DHANMONDI', 'FARMGATE'],
  ['BASHUNDHARA'],
];

function isValidZone(zoneKey) {
  return Object.prototype.hasOwnProperty.call(ZONES, zoneKey);
}

function clusterOf(zoneKey) {
  const found = CLUSTERS.find((c) => c.includes(zoneKey));
  return found || [zoneKey];
}

function sameCluster(zoneA, zoneB) {
  if (zoneA === zoneB) return true;
  return clusterOf(zoneA).includes(zoneB);
}

// The single rule used everywhere in the codebase to decide whether a
// NEW ride request (pickup/destination) may join an EXISTING pool that
// was anchored with (poolPickup/poolDestination).
function isPoolCompatible({ pickupZone, destinationZone }, { poolPickupZone, poolDestinationZone }) {
  return sameCluster(pickupZone, poolPickupZone) && sameCluster(destinationZone, poolDestinationZone);
}

module.exports = { ZONES, CLUSTERS, isValidZone, clusterOf, sameCluster, isPoolCompatible };
