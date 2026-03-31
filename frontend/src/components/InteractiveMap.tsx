import { useState } from 'react';
import { ZoomIn, ZoomOut, Layers as LayersIcon, MapPin } from 'lucide-react';

interface MapLayer {
  id: string;
  label: string;
  enabled: boolean;
}

interface MapMarker {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'node' | 'route' | 'risk';
}

interface InteractiveMapProps {
  markers?: MapMarker[];
  routes?: { from: MapMarker; to: MapMarker }[];
  showControls?: boolean;
}

export default function InteractiveMap({
  markers = [],
  routes = [],
  showControls = true,
}: InteractiveMapProps) {
  const [zoom, setZoom] = useState(1);
  const [showLayers, setShowLayers] = useState(false);
  const [layers, setLayers] = useState<MapLayer[]>([
    { id: 'fiber', label: 'Fiber Routes', enabled: true },
    { id: 'terrain', label: 'Terrain Difficulty', enabled: true },
    { id: 'population', label: 'Population Density', enabled: false },
    { id: 'infrastructure', label: 'Existing Infrastructure', enabled: true },
  ]);

  const toggleLayer = (id: string) => {
    setLayers(layers.map(layer =>
      layer.id === id ? { ...layer, enabled: !layer.enabled } : layer
    ));
  };

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
      <svg
        viewBox="0 0 800 600"
        className="w-full h-full"
        style={{ transform: `scale(${zoom})` }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="800" height="600" fill="url(#grid)" />

        {routes.map((route, index) => (
          <g key={`route-${index}`}>
            <line
              x1={route.from.x}
              y1={route.from.y}
              x2={route.to.x}
              y2={route.to.y}
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="animate-pulse"
            />
          </g>
        ))}

        {markers.map((marker) => {
          const color =
            marker.type === 'node'
              ? '#06b6d4'
              : marker.type === 'route'
              ? '#10b981'
              : '#ef4444';

          return (
            <g key={marker.id}>
              <circle
                cx={marker.x}
                cy={marker.y}
                r="6"
                fill={color}
                className="cursor-pointer hover:r-8 transition-all"
              />
              <circle
                cx={marker.x}
                cy={marker.y}
                r="12"
                fill={color}
                opacity="0.2"
                className="animate-ping"
              />
            </g>
          );
        })}
      </svg>

      {showControls && (
        <>
          <div className="absolute top-4 right-4 flex flex-col space-y-2">
            <button
              onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
              className="p-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
              className="p-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowLayers(!showLayers)}
              className="p-2 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
            >
              <LayersIcon className="w-5 h-5" />
            </button>
          </div>

          {showLayers && (
            <div className="absolute top-4 right-20 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg p-4 min-w-56">
              <h4 className="text-sm font-semibold text-white mb-3">Map Layers</h4>
              <div className="space-y-2">
                {layers.map((layer) => (
                  <label
                    key={layer.id}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={layer.enabled}
                      onChange={() => toggleLayer(layer.id)}
                      className="rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
                    />
                    <span className="text-sm text-slate-300">{layer.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2 text-sm text-slate-300">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>Interactive Network Map</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
