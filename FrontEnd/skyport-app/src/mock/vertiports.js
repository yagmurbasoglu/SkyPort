/**
 * ============================================================
 * MOCK DATA — vertiports.js
 * ============================================================
 * TODO: Replace MOCK_VERTIPORTS with a real API call:
 *   GET /api/vertiports
 *   Expected response: { id, name, lat, lng, features: string[], suitabilityScore: number, distanceFromCenter: number }
 *
 * TODO: Replace generateMockRoute with a real API call:
 *   POST /api/route  { fromId: string, toId: string }
 *   Expected response: { coordinates: [lng,lat][], distance_km: number, duration_min: number, price_tl: number }
 * ============================================================
 */

// ─── Haversine distance helper ────────────────────────────────────────────────
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Istanbul center reference point (Taksim)
const CENTER = { lat: 41.0369, lng: 28.985 };

// ─── Mock vertiport data ───────────────────────────────────────────────────────
export const MOCK_VERTIPORTS = [
  {
    id: 'vp-001',
    name: 'Atatürk Airport Vertiport',
    lat: 40.9769,
    lng: 28.8143,
    features: ['metro', 'parking', 'ev_charging'],
    suitabilityScore: 88,
    pricePerKm: 3.2,
    description: 'Main hub at the former Atatürk Airport site, fully equipped for UAM operations.',
  },
  {
    id: 'vp-002',
    name: 'Sabiha Gökçen Vertiport',
    lat: 40.8987,
    lng: 29.3095,
    features: ['parking', 'ev_charging'],
    suitabilityScore: 82,
    pricePerKm: 3.5,
    description: 'Eastern hub integrated with Sabiha Gökçen International Airport.',
  },
  {
    id: 'vp-003',
    name: 'Beşiktaş Waterfront Vertiport',
    lat: 41.0425,
    lng: 29.0047,
    features: ['metro', 'low_noise'],
    suitabilityScore: 91,
    pricePerKm: 4.0,
    description: 'Premium Bosphorus-side vertiport with direct metro connection.',
  },
  {
    id: 'vp-004',
    name: 'Kadıköy Hub Vertiport',
    lat: 40.9905,
    lng: 29.0302,
    features: ['metro', 'low_noise'],
    suitabilityScore: 87,
    pricePerKm: 3.6,
    description: 'Central Asian-side vertiport near Kadıköy ferry and metro station.',
  },
  {
    id: 'vp-005',
    name: 'Taksim Central Vertiport',
    lat: 41.0369,
    lng: 28.985,
    features: ['metro'],
    suitabilityScore: 79,
    pricePerKm: 4.2,
    description: 'High-demand central Istanbul vertiport above Taksim Square.',
  },
  {
    id: 'vp-006',
    name: 'Bağcılar Metro Vertiport',
    lat: 41.04,
    lng: 28.855,
    features: ['metro', 'parking'],
    suitabilityScore: 74,
    pricePerKm: 2.8,
    description: 'Western corridor vertiport serving Bağcılar and Esenler districts.',
  },
  {
    id: 'vp-007',
    name: 'Sarıyer North Vertiport',
    lat: 41.1667,
    lng: 29.05,
    features: ['low_noise', 'parking'],
    suitabilityScore: 85,
    pricePerKm: 3.1,
    description: 'Quiet northern Bosphorus vertiport, ideal for suburban commuters.',
  },
  {
    id: 'vp-008',
    name: 'Kartal East Vertiport',
    lat: 40.881,
    lng: 29.2017,
    features: ['metro', 'ev_charging'],
    suitabilityScore: 80,
    pricePerKm: 2.9,
    description: 'Far-east hub connecting Kartal, Maltepe, and Pendik districts.',
  },
  {
    id: 'vp-009',
    name: 'Bakırköy Coast Vertiport',
    lat: 40.9794,
    lng: 28.8694,
    features: ['parking', 'low_noise'],
    suitabilityScore: 76,
    pricePerKm: 3.0,
    description: 'Coastal vertiport west of the city, near Florya and Yeşilköy.',
  },
  {
    id: 'vp-010',
    name: 'Üsküdar Ferry Vertiport',
    lat: 41.022,
    lng: 29.0151,
    features: ['metro', 'low_noise'],
    suitabilityScore: 90,
    pricePerKm: 3.8,
    description: 'Premium vertiport above Üsküdar ferry terminal with panoramic views.',
  },
  {
    id: 'vp-011',
    name: 'Maslak Tech Campus Vertiport',
    lat: 41.1118,
    lng: 29.021,
    features: ['metro', 'parking', 'ev_charging'],
    suitabilityScore: 84,
    pricePerKm: 3.3,
    description: 'Northern business-district vertiport placed for short test corridors away from major NFZ clusters.',
  },
  {
    id: 'vp-012',
    name: 'Istinye Valley Vertiport',
    lat: 41.1094,
    lng: 29.0417,
    features: ['low_noise', 'parking'],
    suitabilityScore: 83,
    pricePerKm: 3.2,
    description: 'Short-hop Bosphorus-side vertiport intended for passenger route simulation checks.',
  },
].map((vp) => ({
  ...vp,
  // Auto-calculate distance from Istanbul center so filtering works correctly
  distanceFromCenter: parseFloat(haversineKm(CENTER.lat, CENTER.lng, vp.lat, vp.lng).toFixed(1)),
}));

// ─── Feature display helpers ───────────────────────────────────────────────────
export const FEATURE_LABELS = {
  metro: 'Metro Connection',
  low_noise: 'Low Noise Area',
  parking: 'Covered Parking',
  ev_charging: 'EV Charging',
};

export const FEATURE_ICONS = {
  metro: '🚇',
  low_noise: '🔇',
  parking: '🅿️',
  ev_charging: '⚡',
};

// ─── Mock route generator ──────────────────────────────────────────────────────
// TODO: Replace this entire function with: POST /api/route { fromId, toId }
export const generateMockRoute = (fromVp, toVp) => {
  const steps = 40;
  const coords = [];

  // Perpendicular direction for arc curve
  const dLng = toVp.lng - fromVp.lng;
  const dLat = toVp.lat - fromVp.lat;
  const perpLen = Math.sqrt(dLng * dLng + dLat * dLat) || 1;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = fromVp.lng + dLng * t;
    const lat = fromVp.lat + dLat * t;
    // Slight arc perpendicular to the path
    const arc = Math.sin(t * Math.PI) * 0.015;
    coords.push([lng + (-dLat / perpLen) * arc, lat + (dLng / perpLen) * arc]);
  }

  const distance = haversineKm(fromVp.lat, fromVp.lng, toVp.lat, toVp.lng);
  const durationMin = Math.max(3, Math.round(distance / 2)); // air taxi ~120 km/h
  const priceTl = Math.round(distance * 4.5 + 15);

  return {
    fromVertiport: fromVp,
    toVertiport: toVp,
    coordinates: coords,
    distance_km: parseFloat(distance.toFixed(1)),
    duration_min: durationMin,
    price_tl: priceTl,
  };
};
