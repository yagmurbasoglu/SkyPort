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

const CENTER = { lat: 41.0369, lng: 28.985 };

// ─── Mock vertiport data ───────────────────────────────────────────────────────
export const MOCK_VERTIPORTS = [
  {
    id: 'vp-001',
    name: 'Atatürk Airport Vertiport',
    lat: 40.9769,
    lng: 28.8143,
    features: ['metro', 'parking', 'ev_charging', 'wifi', 'security'],
    suitabilityScore: 88,
    pricePerKm: 120,
    description: 'Main hub at the former Atatürk Airport site, fully equipped for UAM operations.',
  },
  {
    id: 'vp-002',
    name: 'Sabiha Gökçen Vertiport',
    lat: 40.8987,
    lng: 29.3095,
    features: ['parking', 'ev_charging', 'fast_charge', 'security'],
    suitabilityScore: 82,
    pricePerKm: 120,
    description: 'Eastern hub integrated with Sabiha Gökçen International Airport.',
  },
  {
    id: 'vp-003',
    name: 'Beşiktaş Waterfront Vertiport',
    lat: 41.0425,
    lng: 29.0047,
    features: ['metro', 'low_noise', 'lounge', 'wifi'],
    suitabilityScore: 91,
    pricePerKm: 120,
    description: 'Premium Bosphorus-side vertiport with direct metro connection.',
  },
  {
    id: 'vp-004',
    name: 'Kadıköy Hub Vertiport',
    lat: 40.9905,
    lng: 29.0302,
    features: ['metro', 'low_noise', 'wifi'],
    suitabilityScore: 87,
    pricePerKm: 120,
    description: 'Central Asian-side vertiport near Kadıköy ferry and metro station.',
  },
  {
    id: 'vp-005',
    name: 'Taksim Central Vertiport',
    lat: 41.0369,
    lng: 28.985,
    features: ['metro', 'lounge', 'wifi', 'security'],
    suitabilityScore: 79,
    pricePerKm: 120,
    description: 'High-demand central Istanbul vertiport above Taksim Square.',
  },
  {
    id: 'vp-006',
    name: 'Bağcılar Metro Vertiport',
    lat: 41.04,
    lng: 28.855,
    features: ['metro', 'parking', 'wifi'],
    suitabilityScore: 74,
    pricePerKm: 120,
    description: 'Western corridor vertiport serving Bağcılar and Esenler districts.',
  },
  {
    id: 'vp-007',
    name: 'Sarıyer North Vertiport',
    lat: 41.1667,
    lng: 29.05,
    features: ['low_noise', 'parking', 'ev_charging'],
    suitabilityScore: 85,
    pricePerKm: 120,
    description: 'Quiet northern Bosphorus vertiport, ideal for suburban commuters.',
  },
  {
    id: 'vp-008',
    name: 'Kartal East Vertiport',
    lat: 40.881,
    lng: 29.2017,
    features: ['metro', 'ev_charging', 'fast_charge', 'security'],
    suitabilityScore: 80,
    pricePerKm: 120,
    description: 'Far-east hub connecting Kartal, Maltepe, and Pendik districts.',
  },
  {
    id: 'vp-009',
    name: 'Bakırköy Coast Vertiport',
    lat: 40.9794,
    lng: 28.8694,
    features: ['parking', 'low_noise', 'wifi'],
    suitabilityScore: 76,
    pricePerKm: 120,
    description: 'Coastal vertiport west of the city, near Florya and Yeşilköy.',
  },
  {
    id: 'vp-010',
    name: 'Üsküdar Ferry Vertiport',
    lat: 41.022,
    lng: 29.0151,
    features: ['metro', 'low_noise', 'lounge', 'wifi'],
    suitabilityScore: 90,
    pricePerKm: 120,
    description: 'Premium vertiport above Üsküdar ferry terminal with panoramic views.',
  },
  {
    id: 'vp-011',
    name: 'Maslak Tech Campus Vertiport',
    lat: 41.1118,
    lng: 29.021,
    features: ['metro', 'parking', 'ev_charging', 'fast_charge', 'wifi', 'lounge'],
    suitabilityScore: 84,
    pricePerKm: 120,
    description: 'Northern business-district vertiport serving tech campuses and finance hubs.',
  },
  {
    id: 'vp-012',
    name: 'Istinye Valley Vertiport',
    lat: 41.1094,
    lng: 29.0417,
    features: ['low_noise', 'parking', 'wifi'],
    suitabilityScore: 83,
    pricePerKm: 120,
    description: 'Short-hop Bosphorus-side vertiport intended for passenger route simulation checks.',
  },
].map((vp) => ({
  ...vp,
  distanceFromCenter: parseFloat(haversineKm(CENTER.lat, CENTER.lng, vp.lat, vp.lng).toFixed(1)),
}));

// ─── Feature display helpers ───────────────────────────────────────────────────
export const FEATURE_LABELS = {
  metro: 'Metro Connection',
  low_noise: 'Low Noise Area',
  parking: 'Covered Parking',
  ev_charging: 'EV Charging',
  wifi: 'Free Wi-Fi',
  lounge: 'VIP Lounge',
  fast_charge: 'Fast Charge (45 min)',
  security: '24/7 Security',
};

export const FEATURE_ICONS = {
  metro: '🚇',
  low_noise: '🔇',
  parking: '🅿️',
  ev_charging: '⚡',
  wifi: '📶',
  lounge: '🛋️',
  fast_charge: '🔋',
  security: '🛡️',
};

export const FEATURE_DESCRIPTIONS = {
  metro: 'Direct metro access within 2-min walk',
  low_noise: 'Noise level below 65 dB at ground',
  parking: 'Covered parking for up to 200 vehicles',
  ev_charging: 'Standard EV chargers (Type 2)',
  wifi: 'High-speed Wi-Fi in terminal area',
  lounge: 'VIP lounge with refreshments & seating',
  fast_charge: 'Rapid charge: 80% in 45 minutes',
  security: 'Armed security 24/7, biometric entry',
};

// ─── Mock route generator ──────────────────────────────────────────────────────
export const generateMockRoute = (fromVp, toVp) => {
  const steps = 40;
  const coords = [];
  const dLng = toVp.lng - fromVp.lng;
  const dLat = toVp.lat - fromVp.lat;
  const perpLen = Math.sqrt(dLng * dLng + dLat * dLat) || 1;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng = fromVp.lng + dLng * t;
    const lat = fromVp.lat + dLat * t;
    const arc = Math.sin(t * Math.PI) * 0.015;
    coords.push([lng + (-dLat / perpLen) * arc, lat + (dLng / perpLen) * arc]);
  }

  const distance = haversineKm(fromVp.lat, fromVp.lng, toVp.lat, toVp.lng);
  const durationMin = Math.max(3, Math.round(distance / 2));
  const priceTl = Math.round(distance * 120 + 300);

  return {
    fromVertiport: fromVp,
    toVertiport: toVp,
    coordinates: coords,
    distance_km: parseFloat(distance.toFixed(1)),
    duration_min: durationMin,
    price_tl: priceTl,
  };
};
