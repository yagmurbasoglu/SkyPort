const MAPBOX_PLACEHOLDER = 'your_mapbox_token_here';

export const hasMapboxToken = () => {
  const token = process.env.REACT_APP_MAPBOX_TOKEN;
  return Boolean(token && token.trim() && token !== MAPBOX_PLACEHOLDER);
};

export const getMapStyle = () => {
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
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: 'Tiles &copy; Esri',
      },
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
      },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
      },
    ],
  };
};
