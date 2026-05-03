const haversineKm = (lat1, lng1, lat2, lng2) => {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const CENTER = { lat: 41.0369, lng: 28.985 };

export const MOCK_VERTIPORTS = [
  {
    id: 'vp-001',
    name: 'Ataturk Airport Vertiport',
    lat: 40.9769,
    lng: 28.8143,
    features: ['metro', 'parking', 'ev_charging', 'wifi', 'security'],
    suitabilityScore: 88,
    pricePerKm: 120,
    description: 'Main hub at the former Ataturk Airport site, fully equipped for UAM operations.',
  },
  {
    id: 'vp-002',
    name: 'Sabiha Gokcen Vertiport',
    lat: 40.8987,
    lng: 29.3095,
    features: ['parking', 'ev_charging', 'fast_charge', 'security'],
    suitabilityScore: 82,
    pricePerKm: 120,
    description: 'Eastern hub integrated with Sabiha Gokcen International Airport.',
  },
  {
    id: 'vp-003',
    name: 'Mecidiyekoy Transfer Vertiport',
    lat: 41.0678,
    lng: 28.9876,
    features: ['metro', 'low_noise', 'lounge', 'wifi'],
    suitabilityScore: 91,
    pricePerKm: 120,
    description: 'Dense transfer hub placed outside core NFZ corridors, with direct metro access for passenger routes.',
  },
  {
    id: 'vp-004',
    name: 'Kadikoy Hub Vertiport',
    lat: 40.9905,
    lng: 29.0302,
    features: ['metro', 'low_noise', 'wifi'],
    suitabilityScore: 87,
    pricePerKm: 120,
    description: 'Central Asian-side vertiport near Kadikoy ferry and metro station.',
  },
  {
    id: 'vp-005',
    name: 'Zeytinburnu Central Vertiport',
    lat: 41.0065,
    lng: 28.9098,
    features: ['metro', 'lounge', 'wifi', 'security'],
    suitabilityScore: 79,
    pricePerKm: 120,
    description: 'High-demand western connector placed on a safer urban corridor away from NFZ clusters.',
  },
  {
    id: 'vp-006',
    name: 'Bagcilar Metro Vertiport',
    lat: 41.04,
    lng: 28.855,
    features: ['metro', 'parking', 'wifi'],
    suitabilityScore: 74,
    pricePerKm: 120,
    description: 'Western corridor vertiport serving Bagcilar and Esenler districts.',
  },
  {
    id: 'vp-007',
    name: 'Sariyer North Vertiport',
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
    name: 'Bakirkoy Coast Vertiport',
    lat: 40.9794,
    lng: 28.8694,
    features: ['parking', 'low_noise', 'wifi'],
    suitabilityScore: 76,
    pricePerKm: 120,
    description: 'Coastal vertiport west of the city, near Florya and Yesilkoy.',
  },
  {
    id: 'vp-010',
    name: 'Umraniye Transfer Vertiport',
    lat: 41.0248,
    lng: 29.1165,
    features: ['metro', 'low_noise', 'lounge', 'wifi'],
    suitabilityScore: 90,
    pricePerKm: 120,
    description: 'Asian-side transfer vertiport shifted outside the Bosphorus NFZ band for safer passenger routing.',
  },
  {
    id: 'vp-011',
    name: 'Sultangazi North Vertiport',
    lat: 41.1185,
    lng: 28.886,
    features: ['metro', 'parking', 'ev_charging', 'fast_charge', 'wifi', 'lounge'],
    suitabilityScore: 84,
    pricePerKm: 120,
    description: 'Northern commuter vertiport repositioned away from coastal NFZ pressure and optimized for route tests.',
  },
  {
    id: 'vp-012',
    name: 'Basaksehir Valley Vertiport',
    lat: 41.1018,
    lng: 28.8022,
    features: ['low_noise', 'parking', 'wifi'],
    suitabilityScore: 83,
    pricePerKm: 120,
    description: 'Short-hop western vertiport intended for passenger route simulation checks outside active NFZ geometry.',
  },
].map((vertiport) => ({
  ...vertiport,
  distanceFromCenter: parseFloat(
    haversineKm(CENTER.lat, CENTER.lng, vertiport.lat, vertiport.lng).toFixed(1)
  ),
}));

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
  metro: 'M',
  low_noise: 'L',
  parking: 'P',
  ev_charging: 'E',
  wifi: 'W',
  lounge: 'V',
  fast_charge: 'F',
  security: 'S',
};

export const FEATURE_DESCRIPTIONS = {
  metro: 'Direct metro access within 2-min walk',
  low_noise: 'Noise level below 65 dB at ground',
  parking: 'Covered parking for up to 200 vehicles',
  ev_charging: 'Standard EV chargers (Type 2)',
  wifi: 'High-speed Wi-Fi in terminal area',
  lounge: 'VIP lounge with refreshments and seating',
  fast_charge: 'Rapid charge: 80% in 45 minutes',
  security: 'Armed security 24/7 with biometric entry',
};

export const generateMockRoute = (fromVertiport, toVertiport) => {
  const steps = 40;
  const coordinates = [];
  const dLng = toVertiport.lng - fromVertiport.lng;
  const dLat = toVertiport.lat - fromVertiport.lat;
  const perpLen = Math.sqrt(dLng * dLng + dLat * dLat) || 1;

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const lng = fromVertiport.lng + dLng * t;
    const lat = fromVertiport.lat + dLat * t;
    const arc = Math.sin(t * Math.PI) * 0.015;
    coordinates.push([lng + (-dLat / perpLen) * arc, lat + (dLng / perpLen) * arc]);
  }

  const distance = haversineKm(fromVertiport.lat, fromVertiport.lng, toVertiport.lat, toVertiport.lng);
  const durationMin = Math.max(3, Math.round(distance / 2));
  const priceTl = Math.round(distance * 120);

  return {
    fromVertiport,
    toVertiport,
    coordinates,
    distance_km: parseFloat(distance.toFixed(1)),
    duration_min: durationMin,
    price_tl: priceTl,
  };
};
