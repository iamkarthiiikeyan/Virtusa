/**
 * RouteMap — Leaflet satellite map for displaying computed fiber routes.
 * Used by NetworkPlanner and DigitalTwinLab.
 */
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Red marker for Central Office
const coIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface RouteEdge {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  length_m: number;
}

interface RouteMapProps {
  routeEdges: RouteEdge[];
  sourceNode?: { lat: number; lon: number } | null;
  center?: [number, number];
  zoom?: number;
  height?: string;
  /** For Digital Twin: color each edge by phase index (i % phaseCount) */
  phaseColors?: string[];
  /** Which phases are visible (0-indexed) */
  activePhase?: number;
  /** Polygon overlay */
  polygon?: [number, number][];
}

function FitBounds({ routeEdges }: { routeEdges: RouteEdge[] }) {
  const map = useMap();
  useEffect(() => {
    if (routeEdges.length > 0) {
      const lats = routeEdges.flatMap(e => [e.from.lat, e.to.lat]);
      const lons = routeEdges.flatMap(e => [e.from.lon, e.to.lon]);
      map.fitBounds(
        [[Math.min(...lats) - 0.002, Math.min(...lons) - 0.002],
         [Math.max(...lats) + 0.002, Math.max(...lons) + 0.002]],
        { padding: [30, 30] }
      );
    }
  }, [routeEdges, map]);
  return null;
}

export default function RouteMap({
  routeEdges,
  sourceNode = null,
  center = [11.341, 77.717],
  zoom = 14,
  height = '500px',
  phaseColors,
  activePhase,
  polygon,
}: RouteMapProps) {
  const phaseCount = phaseColors?.length || 1;

  return (
    <div className="relative w-full rounded-lg overflow-hidden" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        style={{ minHeight: height, background: '#1a1a2e' }}
      >
        {/* Satellite imagery */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri, Maxar, Earthstar Geographics"
        />
        {/* Road labels overlay */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
          attribution=""
          opacity={0.4}
        />

        <FitBounds routeEdges={routeEdges} />

        {/* Polygon overlay */}
        {polygon && polygon.length >= 3 && (
          <Polyline
            positions={[...polygon.map(([lat, lon]) => [lat, lon] as [number, number]), polygon[0] as [number, number]]}
            pathOptions={{ color: '#06b6d4', weight: 2, dashArray: '6,4', fillOpacity: 0 }}
          />
        )}

        {/* Route edges */}
        {routeEdges.map((edge, i) => {
          const phaseIdx = phaseColors ? i % phaseCount : 0;
          const isVisible = activePhase === undefined || phaseIdx <= activePhase;
          const color = phaseColors ? phaseColors[phaseIdx] : '#10b981';

          return (
            <Polyline
              key={`route-${i}`}
              positions={[
                [edge.from.lat, edge.from.lon],
                [edge.to.lat, edge.to.lon],
              ]}
              pathOptions={{
                color: color,
                weight: 3,
                opacity: isVisible ? 0.85 : 0.12,
              }}
            />
          );
        })}

        {/* Central Office marker */}
        {sourceNode && (
          <Marker position={[sourceNode.lat, sourceNode.lon]} icon={coIcon}>
            <Popup>
              <div style={{ color: '#000', fontSize: '13px' }}>
                <strong>Central Office</strong><br />
                Fiber Exchange Point<br />
                {sourceNode.lat.toFixed(5)}, {sourceNode.lon.toFixed(5)}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
