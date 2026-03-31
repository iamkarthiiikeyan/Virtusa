"""Geospatial Agent v7 — Google Earth Engine for exact building counts.

Uses Google Open Buildings V3 dataset via Earth Engine API.
- 200M+ buildings detected from 50cm satellite imagery for India
- Exact count for any polygon, any location
- Confidence scores to filter false positives
- Building area in sq meters for each footprint

Fallback chain if GEE is unavailable:
1. OSM building footprints
2. Area-based density estimation
"""
import random
import math
import logging
import os
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# GEE Configuration
GEE_PROJECT = os.getenv("GEE_PROJECT", "black-pier-490610-b0")
GEE_SERVICE_ACCOUNT = os.getenv(
    "GEE_SERVICE_ACCOUNT",
    "atlas-earth-engine@black-pier-490610-b0.iam.gserviceaccount.com"
)
GEE_KEY_FILE = os.getenv(
    "GEE_KEY_FILE",
    str(Path(__file__).parent.parent.parent / "gee-key.json")
)

DENSITY_BY_TERRAIN = {
    "urban": 2200, "suburban": 900, "rural": 120,
    "mountainous": 45, "default": 600,
}

# GEE singleton
_gee_initialized = False


def _init_gee():
    """Initialize Google Earth Engine once."""
    global _gee_initialized
    if _gee_initialized:
        return True
    try:
        import ee
        if os.path.exists(GEE_KEY_FILE):
            credentials = ee.ServiceAccountCredentials(GEE_SERVICE_ACCOUNT, GEE_KEY_FILE)
            ee.Initialize(credentials, project=GEE_PROJECT)
            _gee_initialized = True
            logger.info(f"GEE initialized with service account (project: {GEE_PROJECT})")
            return True
        else:
            logger.warning(f"GEE key file not found: {GEE_KEY_FILE}")
            return False
    except Exception as e:
        logger.error(f"GEE initialization failed: {e}")
        return False


class GeospatialAgent:

    async def execute(self, location="Custom Area", premises_count=None,
                      source_lat=None, source_lon=None, polygon=None,
                      terrain_type="urban"):
        try:
            import osmnx as ox
            import networkx as nx
        except ImportError:
            return self._make_fallback(polygon, premises_count, terrain_type,
                                       error="osmnx not installed")

        if polygon and len(polygon) >= 3:
            return await self._process_polygon(
                ox, nx, polygon, premises_count, source_lat, source_lon, terrain_type)
        else:
            return await self._process_place(
                ox, nx, location, premises_count, source_lat, source_lon, terrain_type)

    # ─────────────────────────────────────────
    # GOOGLE EARTH ENGINE BUILDING DETECTION
    # ─────────────────────────────────────────

    def _query_gee_buildings(self, polygon_coords):
        """Query Google Open Buildings V3 via Earth Engine.
        
        Args:
            polygon_coords: list of [lat, lon] pairs
            
        Returns:
            (count, centroids_list, total_area_m2, avg_confidence)
        """
        if not _init_gee():
            return 0, [], 0, 0

        try:
            import ee

            # Convert to GEE polygon (GEE uses [lon, lat] order)
            gee_coords = [[pt[1], pt[0]] for pt in polygon_coords]
            if gee_coords[0] != gee_coords[-1]:
                gee_coords.append(gee_coords[0])
            
            gee_polygon = ee.Geometry.Polygon([gee_coords])

            # Query Google Open Buildings V3
            buildings = ee.FeatureCollection(
                'GOOGLE/Research/open-buildings/v3/polygons'
            ).filter(
                ee.Filter.bounds(gee_polygon)
            ).filter(
                ee.Filter.gte('confidence', 0.65)  # Min confidence threshold
            )

            # Get count
            count = buildings.size().getInfo()
            logger.info(f"GEE: {count:,} buildings detected (confidence >= 0.65)")

            if count == 0:
                return 0, [], 0, 0

            # Get aggregate stats
            total_area = buildings.aggregate_sum('area_in_meters').getInfo()
            avg_confidence = buildings.aggregate_mean('confidence').getInfo()

            # Get centroids for routing (sample up to 500)
            centroids = []
            if count <= 5000:
                # For manageable sizes, get actual centroids
                sample = buildings.limit(500)
                features = sample.getInfo().get('features', [])
                for f in features:
                    props = f.get('properties', {})
                    geom = f.get('geometry', {})
                    coords = geom.get('coordinates', [])
                    if coords:
                        # Building polygon — get centroid
                        if geom.get('type') == 'Polygon' and coords:
                            ring = coords[0]
                            clat = sum(c[1] for c in ring) / len(ring)
                            clon = sum(c[0] for c in ring) / len(ring)
                            centroids.append({"lat": clat, "lon": clon})
            else:
                # For large areas, sample randomly
                sample = buildings.randomColumn().sort('random').limit(500)
                features = sample.getInfo().get('features', [])
                for f in features:
                    geom = f.get('geometry', {})
                    coords = geom.get('coordinates', [])
                    if coords and geom.get('type') == 'Polygon':
                        ring = coords[0]
                        clat = sum(c[1] for c in ring) / len(ring)
                        clon = sum(c[0] for c in ring) / len(ring)
                        centroids.append({"lat": clat, "lon": clon})

            logger.info(f"GEE: total_area={total_area:,.0f}m2, "
                        f"avg_conf={avg_confidence:.2f}, centroids={len(centroids)}")

            return count, centroids, total_area, avg_confidence

        except Exception as e:
            logger.error(f"GEE query failed: {e}")
            return 0, [], 0, 0

    # ─────────────────────────────────────────
    # BUILDING DETECTION WITH FALLBACK CHAIN
    # ─────────────────────────────────────────

    def _detect_buildings(self, ox, polygon_coords, poly_shapely, area_sq_km, terrain_type):
        """Detect buildings: GEE first, then OSM, then density estimation."""

        # Method 1: Google Earth Engine (exact satellite-detected buildings)
        gee_count, gee_centroids, gee_area, gee_conf = self._query_gee_buildings(polygon_coords)
        if gee_count > 0:
            return gee_count, gee_centroids, "google_earth_engine", {
                "total_building_area_m2": gee_area,
                "avg_confidence": round(gee_conf, 3),
                "avg_building_size_m2": round(gee_area / gee_count, 1) if gee_count > 0 else 0,
                "source_dataset": "Google Open Buildings V3 (50cm satellite)",
            }

        # Method 2: OSM building footprints
        try:
            buildings_gdf = ox.features_from_polygon(poly_shapely, tags={"building": True})
            osm_count = len(buildings_gdf)
            if osm_count > 0:
                centroids = []
                for c in buildings_gdf.geometry.centroid[:500]:
                    centroids.append({"lat": c.y, "lon": c.x})
                # Scale up (OSM is typically 30-70% complete)
                estimated = int(osm_count / 0.5)
                logger.info(f"OSM: {osm_count} buildings, estimated total: {estimated}")
                return estimated, centroids, "osm_scaled", {
                    "osm_raw_count": osm_count,
                    "completeness_factor": 0.5,
                }
        except Exception as e:
            logger.debug(f"OSM buildings failed: {e}")

        # Method 3: Area-based density estimation
        density = DENSITY_BY_TERRAIN.get(terrain_type, DENSITY_BY_TERRAIN["default"])
        estimated = max(10, int(area_sq_km * density))
        logger.info(f"Density estimation: {area_sq_km:.3f}km2 x {density}/km2 = {estimated}")
        return estimated, [], "terrain_density", {
            "density_per_km2": density,
            "terrain_type": terrain_type,
        }

    # ─────────────────────────────────────────
    # POLYGON MODE
    # ─────────────────────────────────────────

    async def _process_polygon(self, ox, nx, polygon, premises_count,
                                source_lat, source_lon, terrain_type):
        from shapely.geometry import Polygon as ShapelyPolygon

        coords = [(pt[1], pt[0]) for pt in polygon]
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        poly = ShapelyPolygon(coords)

        center_lat = sum(pt[0] for pt in polygon) / len(polygon)
        center_lon = sum(pt[1] for pt in polygon) / len(polygon)
        area_sq_km = self._calc_area(polygon, center_lat, center_lon)

        logger.info(f"POLYGON: {area_sq_km:.4f} km2, center=({center_lat:.4f},{center_lon:.4f})")

        # Detect buildings
        detected, centroids, source, extra_info = self._detect_buildings(
            ox, polygon, poly, area_sq_km, terrain_type)

        # Use detected unless user explicitly specified
        final_premises = premises_count if premises_count and premises_count > 0 else detected
        logger.info(f"BUILDINGS: {detected} ({source}), using: {final_premises}")

        # Road network
        G = None
        try:
            G = ox.graph_from_polygon(poly, network_type="drive")
        except Exception:
            try:
                dist = max(500, int(math.sqrt(area_sq_km) * 1000))
                G = ox.graph_from_point((center_lat, center_lon), dist=dist, network_type="drive")
            except Exception as e:
                logger.error(f"Road network failed: {e}")

        if G is None or len(G.nodes) < 3:
            return {
                "route_length_km": round(final_premises * 0.02, 2),
                "sampled_route_km": 0,
                "total_edges": 0, "total_nodes": 0,
                "premises_connected": final_premises,
                "premises_sampled": 0,
                "source_node": {"lat": center_lat, "lon": center_lon},
                "route_edges": [],
                "strategy": "estimation_no_roads",
                "area_analysis": self._area_info(
                    area_sq_km, detected, source, centroids, polygon,
                    center_lat, center_lon, extra_info),
                "network_stats": None,
            }

        # Routing
        source_node = self._get_source(ox, G, source_lat, source_lon, center_lat, center_lon)
        terminals = self._get_terminals(ox, G, source_node, centroids, final_premises)

        try:
            steiner = nx.algorithms.approximation.steiner_tree(
                G.to_undirected(), [source_node] + list(terminals), weight="length")
        except Exception:
            return {
                "route_length_km": round(final_premises * 0.02, 2),
                "sampled_route_km": 0,
                "total_edges": 0, "total_nodes": 0,
                "premises_connected": final_premises,
                "premises_sampled": len(terminals),
                "source_node": {"lat": G.nodes[source_node]["y"], "lon": G.nodes[source_node]["x"]},
                "route_edges": [],
                "strategy": "steiner_failed",
                "area_analysis": self._area_info(
                    area_sq_km, detected, source, centroids, polygon,
                    center_lat, center_lon, extra_info),
                "network_stats": {"total_road_nodes": len(G.nodes), "total_road_edges": len(G.edges)},
            }

        total_m = sum(d.get("length", 0) for _, _, d in steiner.edges(data=True))
        route_km = total_m / 1000
        route_edges = [
            {"from": {"lat": G.nodes[u]["y"], "lon": G.nodes[u]["x"]},
             "to": {"lat": G.nodes[v]["y"], "lon": G.nodes[v]["x"]},
             "length_m": round(d.get("length", 0), 1)}
            for u, v, d in steiner.edges(data=True)
        ]

        scale = final_premises / max(len(terminals), 1)
        estimated_km = route_km * min(scale, 5.0)

        return {
            "route_length_km": round(estimated_km, 2),
            "sampled_route_km": round(route_km, 2),
            "total_edges": len(steiner.edges),
            "total_nodes": len(steiner.nodes),
            "premises_connected": final_premises,
            "premises_sampled": len(terminals),
            "source_node": {"lat": G.nodes[source_node]["y"], "lon": G.nodes[source_node]["x"]},
            "route_edges": route_edges,
            "strategy": "steiner_tree",
            "area_analysis": self._area_info(
                area_sq_km, detected, source, centroids, polygon,
                center_lat, center_lon, extra_info),
            "network_stats": {"total_road_nodes": len(G.nodes), "total_road_edges": len(G.edges)},
        }

    # ─────────────────────────────────────────
    # PLACE NAME MODE
    # ─────────────────────────────────────────

    async def _process_place(self, ox, nx, location, premises_count,
                              source_lat, source_lon, terrain_type):
        try:
            G = ox.graph_from_place(location, network_type="drive")
        except Exception as e:
            return self._make_fallback(None, premises_count, terrain_type, str(e))

        # Try to get place boundary for building detection
        area_analysis = None
        detected_premises = 0
        try:
            gdf = ox.geocode_to_gdf(location)
            if not gdf.empty:
                poly = gdf.geometry.iloc[0]
                center = gdf.geometry.centroid.iloc[0]
                try:
                    area_sq_km = float(gdf.to_crs(epsg=32643).geometry.area.iloc[0]) / 1e6
                except:
                    area_sq_km = float(gdf.geometry.area.iloc[0]) * (111.32 ** 2)

                # Extract polygon coords for GEE
                exterior = poly.exterior.coords[:]
                polygon_coords = [[c[1], c[0]] for c in exterior]  # lat, lon

                detected, centroids, source, extra = self._detect_buildings(
                    ox, polygon_coords, poly, area_sq_km, terrain_type)
                detected_premises = detected

                area_analysis = {
                    "area_sq_km": round(area_sq_km, 4),
                    "detected_buildings": detected,
                    "building_source": source,
                    "building_centroids_used": len(centroids),
                    "polygon_vertices": len(polygon_coords),
                    "landuse_info": extra,
                }
        except Exception as e:
            logger.debug(f"Place boundary analysis: {e}")

        final_premises = premises_count if premises_count and premises_count > 0 else (detected_premises or 100)

        if source_lat and source_lon:
            source_node = ox.nearest_nodes(G, source_lon, source_lat)
        else:
            nodes_gdf = ox.graph_to_gdfs(G, edges=False)
            source_node = ox.nearest_nodes(G, nodes_gdf.geometry.x.mean(), nodes_gdf.geometry.y.mean())

        all_nodes = list(G.nodes)
        rng = random.Random(42)
        sample = min(final_premises, len(all_nodes) - 1, 200)
        terminals = rng.sample([n for n in all_nodes if n != source_node], sample)

        steiner = nx.algorithms.approximation.steiner_tree(
            G.to_undirected(), [source_node] + terminals, weight="length")

        total_m = sum(d.get("length", 0) for _, _, d in steiner.edges(data=True))
        route_km = total_m / 1000
        route_edges = [
            {"from": {"lat": G.nodes[u]["y"], "lon": G.nodes[u]["x"]},
             "to": {"lat": G.nodes[v]["y"], "lon": G.nodes[v]["x"]},
             "length_m": round(d.get("length", 0), 1)}
            for u, v, d in steiner.edges(data=True)
        ]

        scale = final_premises / max(sample, 1)
        return {
            "route_length_km": round(route_km * min(scale, 5.0), 2),
            "sampled_route_km": round(route_km, 2),
            "total_edges": len(steiner.edges),
            "total_nodes": len(steiner.nodes),
            "premises_connected": final_premises,
            "premises_sampled": sample,
            "source_node": {"lat": G.nodes[source_node]["y"], "lon": G.nodes[source_node]["x"]},
            "route_edges": route_edges,
            "strategy": "steiner_tree",
            "area_analysis": area_analysis,
            "network_stats": {"total_road_nodes": len(G.nodes), "total_road_edges": len(G.edges)},
        }

    # ─────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────

    def _calc_area(self, polygon, clat, clon):
        from shapely.geometry import Polygon as SP
        lon_km = 111.32 * math.cos(math.radians(clat))
        kc = [((p[1]-clon)*lon_km, (p[0]-clat)*111.32) for p in polygon]
        if kc[0] != kc[-1]:
            kc.append(kc[0])
        return abs(SP(kc).area)

    def _get_source(self, ox, G, slat, slon, clat, clon):
        if slat and slon:
            return ox.nearest_nodes(G, slon, slat)
        return ox.nearest_nodes(G, clon, clat)

    def _get_terminals(self, ox, G, source_node, centroids, premises):
        all_nodes = list(G.nodes)
        if centroids and len(centroids) > 5:
            terms = set()
            for bc in centroids[:200]:
                try:
                    nn = ox.nearest_nodes(G, bc["lon"], bc["lat"])
                    if nn != source_node:
                        terms.add(nn)
                except:
                    pass
            if len(terms) > 2:
                return list(terms)[:200]
        rng = random.Random(42)
        size = min(premises, len(all_nodes) - 1, 200)
        return rng.sample([n for n in all_nodes if n != source_node], size)

    def _area_info(self, area, detected, source, centroids, polygon, clat, clon, extra):
        return {
            "area_sq_km": round(area, 4),
            "detected_buildings": detected,
            "building_source": source,
            "building_centroids_used": len(centroids),
            "polygon_vertices": len(polygon) if polygon else 0,
            "center": {"lat": round(clat, 6), "lon": round(clon, 6)},
            "landuse_info": extra,
        }

    def _make_fallback(self, polygon, premises, terrain_type, error=None):
        area_sq_km = 0
        clat = clon = 0
        if polygon and len(polygon) >= 3:
            clat = sum(p[0] for p in polygon) / len(polygon)
            clon = sum(p[1] for p in polygon) / len(polygon)
            area_sq_km = self._calc_area(polygon, clat, clon)

        density = DENSITY_BY_TERRAIN.get(terrain_type, 600)
        estimated = max(10, int(area_sq_km * density)) if area_sq_km > 0 else (premises or 100)

        return {
            "route_length_km": round(estimated * 0.02, 2),
            "sampled_route_km": 0,
            "total_edges": 0, "total_nodes": 0,
            "premises_connected": estimated,
            "premises_sampled": 0,
            "source_node": {"lat": clat, "lon": clon} if clat else None,
            "route_edges": [],
            "strategy": "fallback",
            "area_analysis": {
                "area_sq_km": round(area_sq_km, 4),
                "detected_buildings": estimated,
                "building_source": "terrain_density",
                "building_centroids_used": 0,
                "polygon_vertices": len(polygon) if polygon else 0,
                "landuse_info": {},
            } if polygon else None,
            "network_stats": None,
            "error": error,
        }