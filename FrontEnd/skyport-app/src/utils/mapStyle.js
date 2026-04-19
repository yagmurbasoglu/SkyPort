const MAPBOX_PLACEHOLDER = 'your_mapbox_token_here';

export const hasMapboxToken = () => {
  const token = process.env.REACT_APP_MAPBOX_TOKEN;
  return Boolean(token && token.trim() && token !== MAPBOX_PLACEHOLDER);
};

export const getMapStyle = () => {
  if (hasMapboxToken()) {
    return 'mapbox://styles/mapbox/dark-v11';
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  };
};
