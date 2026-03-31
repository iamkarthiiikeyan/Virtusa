"""Route Comparison Agent — Finds multiple routes between two buildings.

Given origin and destination coordinates, computes 5 different routes:
1. Shortest distance — minimum fiber cable length
2. Main road priority — uses highways/arterials (easier permits, wider ducts)
3. Minimum turns — fewest direction changes (fewer splice points)
4. Residential avoidance — avoids narrow residential streets
5. Balanced — weighted combination of distance and road quality

Each route gets a full cost estimate based on:
- Fiber cable length
- Number of splice points (turns/junctions)
- Road type (affects trenching cost)
- Civil work complexity
"""
import logging
import math
import json
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"


class RouteComparisonAgent:

    def __init__(self):
        with open(DATA_DIR / "hardware_catalog_inr.json") as f:
            self.catalog = json.load(f)["catalog"]

    async def execute(
        self,
        origin_lat: float, origin_lon: float,
        dest_lat: float, dest_lon: float,
        terrain_type: str = "urban",
    ) -> dict:
        try:
            import osmnx as ox
            import networkx as nx
        except ImportError:
            return self._fallback_routes(origin_lat, origin_lon, dest_lat, dest_lon, terrain_type)

        straight_km = self._haversine(origin_lat, origin_lon, dest_lat, dest_lon)
        fetch_dist = max(2000, int(straight_km * 1000 * 1.8))

        mid_lat = (origin_lat + dest_lat) / 2
        mid_lon = (origin_lon + dest_lon) / 2

        try:
            G = ox.graph_from_point((mid_lat, mid_lon), dist=fetch_dist, network_type="drive")
            logger.info(f"Road network: {len(G.nodes)} nodes, {len(G.edges)} edges")
        except Exception as e:
            logger.error(f"Failed to fetch road network: {e}")
            return self._fallback_routes(origin_lat, origin_lon, dest_lat, dest_lon, terrain_type)

        try:
            origin_node = ox.nearest_nodes(G, origin_lon, origin_lat)
            dest_node = ox.nearest_nodes(G, dest_lon, dest_lat)
        except Exception as e:
            logger.error(f"Failed to find nearest nodes: {e}")
            return self._fallback_routes(origin_lat, origin_lon, dest_lat, dest_lon, terrain_type)

        if origin_node == dest_node:
            return {"error": "Origin and destination are too close", "routes": []}

        routes = []

        # Strategy 1: Shortest distance
        r1 = self._compute_route(G, origin_node, dest_node, "length", "Shortest distance")
        if r1:
            r1["description"] = "Minimum fiber cable — most direct path"
            r1["pros"] = "Least fiber cable cost"
            r1["cons"] = "May use narrow streets"
            routes.append(r1)

        # Strategy 2: Main road priority (very aggressive weighting)
        G_main = self._weight_by_road_type(G.copy(), prefer="main")
        r2 = self._compute_route(G_main, origin_node, dest_node, "custom_weight", "Main road priority")
        if r2:
            r2["description"] = "Follows highways and arterials — easier permits, existing ducts"
            r2["pros"] = "Lower permit cost, existing infrastructure"
            r2["cons"] = "Longer distance"
            routes.append(r2)

        # Strategy 3: Minimum turns
        G_turns = self._weight_by_turns(G.copy())
        r3 = self._compute_route(G_turns, origin_node, dest_node, "turn_weight", "Minimum turns")
        if r3:
            r3["description"] = "Fewest direction changes — fewer splice closures"
            r3["pros"] = "Fewer splices, simpler civil work"
            r3["cons"] = "May not be shortest"
            routes.append(r3)

        # Strategy 4: Avoid residential
        G_nores = self._weight_by_road_type(G.copy(), prefer="non_residential")
        r4 = self._compute_route(G_nores, origin_node, dest_node, "custom_weight", "Residential avoidance")
        if r4:
            r4["description"] = "Avoids narrow residential streets — less disruption"
            r4["pros"] = "Less community disruption"
            r4["cons"] = "Longer detour possible"
            routes.append(r4)

        # Strategy 5: Balanced
        G_bal = self._weight_balanced(G.copy())
        r5 = self._compute_route(G_bal, origin_node, dest_node, "balanced_weight", "Balanced route")
        if r5:
            r5["description"] = "Optimal balance of distance, road quality, and complexity"
            r5["pros"] = "Best cost-to-complexity ratio"
            r5["cons"] = "Compromise on all factors"
            routes.append(r5)

        # If we got fewer than 5, use k-shortest-paths to fill the gap
        if len(routes) < 5:
            try:
                k_needed = 5 - len(routes) + 2  # ask for extras in case some overlap
                k_paths = list(nx.shortest_simple_paths(G, origin_node, dest_node, weight="length"))
                alt_names = ["Alternative A", "Alternative B", "Alternative C", "Alternative D"]
                alt_idx = 0
                existing_lengths = {round(r["total_length_m"]) for r in routes}

                for path in k_paths[:k_needed + 5]:
                    if len(routes) >= 5:
                        break
                    r_alt = self._path_to_route(G, path, alt_names[min(alt_idx, len(alt_names) - 1)])
                    if r_alt and round(r_alt["total_length_m"]) not in existing_lengths:
                        r_alt["description"] = f"Alternative path #{alt_idx + 1} found by k-shortest algorithm"
                        r_alt["pros"] = "Different path option"
                        r_alt["cons"] = "Auto-generated alternative"
                        routes.append(r_alt)
                        existing_lengths.add(round(r_alt["total_length_m"]))
                        alt_idx += 1
            except Exception as e:
                logger.warning(f"k-shortest-paths failed: {e}")

        # Calculate costs for each route
        for i, route in enumerate(routes):
            route["cost"] = self._calculate_route_cost(route, terrain_type)
            route["id"] = f"route_{i+1}"
            route["rank"] = i + 1

        # Sort by total cost
        routes.sort(key=lambda r: r["cost"]["total_cost"])
        for i, route in enumerate(routes):
            route["rank"] = i + 1
        if routes:
            routes[0]["recommended"] = True

        return {
            "origin": {"lat": origin_lat, "lon": origin_lon},
            "destination": {"lat": dest_lat, "lon": dest_lon},
            "straight_line_km": round(straight_km, 2),
            "routes": routes[:5],  # cap at 5
            "total_routes": min(len(routes), 5),
            "recommended_route": routes[0]["id"] if routes else None,
        }

    def _compute_route(self, G, origin, dest, weight, name):
        """Compute a single route using the given edge weight."""
        import networkx as nx

        try:
            path = nx.shortest_path(G, origin, dest, weight=weight)
        except nx.NetworkXNoPath:
            return None

        edges = []
        total_length = 0
        turn_count = 0
        prev_bearing = None

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            data = G.edges[u, v, 0] if G.is_multigraph() else G.edges[u, v]
            length = data.get("length", 0)
            total_length += length

            lat1, lon1 = G.nodes[u]["y"], G.nodes[u]["x"]
            lat2, lon2 = G.nodes[v]["y"], G.nodes[v]["x"]

            # Count turns (bearing change > 30 degrees)
            bearing = math.atan2(lon2 - lon1, lat2 - lat1)
            if prev_bearing is not None:
                angle_diff = abs(bearing - prev_bearing)
                if angle_diff > math.pi:
                    angle_diff = 2 * math.pi - angle_diff
                if angle_diff > math.radians(30):
                    turn_count += 1
            prev_bearing = bearing

            edges.append({
                "from": {"lat": lat1, "lon": lon1},
                "to": {"lat": lat2, "lon": lon2},
                "length_m": round(length, 1),
                "road_type": data.get("highway", "unclassified"),
            })

        return {
            "name": name,
            "edges": edges,
            "total_length_m": round(total_length, 1),
            "total_length_km": round(total_length / 1000, 3),
            "node_count": len(path),
            "edge_count": len(edges),
            "turn_count": turn_count,
            "splice_points": max(2, turn_count + len(edges) // 10),
            "recommended": False,
        }

    def _path_to_route(self, G, path, name):
        """Convert a raw node path to a route dict."""
        edges = []
        total_length = 0
        turn_count = 0
        prev_bearing = None

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            data = G.edges[u, v, 0] if G.is_multigraph() else G.edges[u, v]
            length = data.get("length", 0)
            total_length += length
            lat1, lon1 = G.nodes[u]["y"], G.nodes[u]["x"]
            lat2, lon2 = G.nodes[v]["y"], G.nodes[v]["x"]
            bearing = math.atan2(lon2 - lon1, lat2 - lat1)
            if prev_bearing is not None:
                angle_diff = abs(bearing - prev_bearing)
                if angle_diff > math.pi: angle_diff = 2 * math.pi - angle_diff
                if angle_diff > math.radians(30): turn_count += 1
            prev_bearing = bearing
            edges.append({"from": {"lat": lat1, "lon": lon1}, "to": {"lat": lat2, "lon": lon2},
                          "length_m": round(length, 1), "road_type": data.get("highway", "unclassified")})

        if total_length == 0:
            return None

        return {
            "name": name, "edges": edges,
            "total_length_m": round(total_length, 1),
            "total_length_km": round(total_length / 1000, 3),
            "node_count": len(path), "edge_count": len(edges),
            "turn_count": turn_count,
            "splice_points": max(2, turn_count + len(edges) // 10),
            "recommended": False,
        }

    def _weight_by_road_type(self, G, prefer="main"):
        """Add custom weights based on road type — aggressive multipliers."""
        main_roads = {"motorway", "trunk", "primary", "secondary"}
        residential = {"residential", "living_street", "service"}

        for u, v, key, data in G.edges(keys=True, data=True):
            hw = data.get("highway", "unclassified")
            if isinstance(hw, list): hw = hw[0]
            length = data.get("length", 100)

            if prefer == "main":
                if hw in main_roads:
                    data["custom_weight"] = length * 0.3  # strongly prefer
                elif hw in residential:
                    data["custom_weight"] = length * 5.0  # strongly avoid
                else:
                    data["custom_weight"] = length * 1.5
            elif prefer == "non_residential":
                if hw in residential:
                    data["custom_weight"] = length * 8.0  # very strongly avoid
                elif hw in main_roads:
                    data["custom_weight"] = length * 0.5
                else:
                    data["custom_weight"] = length * 1.0
        return G

    def _weight_by_turns(self, G):
        """Weight edges to minimize direction changes — aggressive."""
        for u, v, key, data in G.edges(keys=True, data=True):
            length = data.get("length", 100)
            if length < 30:
                data["turn_weight"] = length * 8.0  # very short = guaranteed turn
            elif length < 80:
                data["turn_weight"] = length * 3.0
            else:
                data["turn_weight"] = length * 0.5  # strongly prefer long straight segments
        return G

    def _weight_balanced(self, G):
        """Balanced weight — moderate preference for main roads + straight paths."""
        main_roads = {"motorway", "trunk", "primary", "secondary"}
        for u, v, key, data in G.edges(keys=True, data=True):
            length = data.get("length", 100)
            hw = data.get("highway", "unclassified")
            if isinstance(hw, list): hw = hw[0]
            road_factor = 0.5 if hw in main_roads else 1.8
            turn_factor = 2.5 if length < 40 else 1.0
            data["balanced_weight"] = length * road_factor * turn_factor
        return G

    def _calculate_route_cost(self, route, terrain_type):
        """Calculate full cost for a single route."""
        km = route["total_length_km"]
        splices = route["splice_points"]
        is_aerial = terrain_type in ("rural", "mountainous")

        # Fiber cable
        fiber_cost = math.ceil(km) * self.catalog["fiber_cable"]["single_mode_24core_per_km"]["price_inr"]
        drop_cable = self.catalog["fiber_cable"]["drop_cable_per_unit"]["price_inr"] * 2  # origin + dest

        # Civil work
        if is_aerial:
            civil = math.ceil(km) * self.catalog["labor_rates"]["aerial_stringing_per_km"]["price_inr"]
            poles = max(2, math.ceil(km * 1000 / 60)) * self.catalog["civil_infrastructure"]["pole_9m_steel"]["price_inr"]
            civil += poles
        else:
            trench_key = "trenching_rural_per_km" if terrain_type == "rural" else "trenching_urban_per_km"
            civil = math.ceil(km) * self.catalog["labor_rates"][trench_key]["price_inr"]
            duct = math.ceil(km) * self.catalog["civil_infrastructure"]["hdpe_duct_40mm_per_km"]["price_inr"]
            manholes = max(1, math.ceil(km * 1000 / 400)) * self.catalog["civil_infrastructure"]["manhole_chamber"]["price_inr"]
            civil += duct + manholes

        # Splice closures
        splice_cost = splices * self.catalog["passive_equipment"]["splice_closure"]["price_inr"]
        splicing_labor = splices * 24 * self.catalog["labor_rates"]["fiber_splicing_per_joint"]["price_inr"]

        # Testing
        testing = math.ceil(km) * self.catalog["labor_rates"]["otdr_testing_per_km"]["price_inr"]
        survey = math.ceil(km) * self.catalog["labor_rates"]["survey_design_per_km"]["price_inr"]

        # Permits
        permit_key = "road_cutting_urban" if terrain_type == "urban" else "road_cutting_rural"
        permits = math.ceil(km) * self.catalog["permits_regulatory"][permit_key]["price_inr"]

        subtotal = fiber_cost + drop_cable + civil + splice_cost + splicing_labor + testing + survey + permits
        contingency = round(subtotal * 0.12)
        gst = round(subtotal * 0.18)
        total = subtotal + contingency + gst

        return {
            "fiber_cable": fiber_cost + drop_cable,
            "civil_work": civil,
            "splice_closures": splice_cost + splicing_labor,
            "testing_survey": testing + survey,
            "permits": permits,
            "subtotal": subtotal,
            "contingency": contingency,
            "gst": gst,
            "total_cost": total,
            "cost_per_km": round(total / max(km, 0.01)),
        }

    def _haversine(self, lat1, lon1, lat2, lon2):
        """Calculate distance in km between two lat/lon points."""
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return R * 2 * math.asin(math.sqrt(a))

    def _fallback_routes(self, olat, olon, dlat, dlon, terrain):
        """Fallback when OSMnx is unavailable."""
        km = self._haversine(olat, olon, dlat, dlon)
        routes = []
        for i, (name, mult) in enumerate([
            ("Direct path", 1.0), ("Main road", 1.3), ("Alternative 1", 1.15),
            ("Alternative 2", 1.25), ("Long detour", 1.5)
        ]):
            route_km = km * mult
            routes.append({
                "id": f"route_{i+1}", "name": name, "rank": i+1,
                "description": f"Estimated {name.lower()} route",
                "edges": [{"from": {"lat": olat, "lon": olon}, "to": {"lat": dlat, "lon": dlon}, "length_m": route_km * 1000, "road_type": "estimated"}],
                "total_length_m": round(route_km * 1000, 1),
                "total_length_km": round(route_km, 3),
                "node_count": 2, "edge_count": 1, "turn_count": 0,
                "splice_points": max(2, int(route_km * 2)),
                "recommended": i == 0,
                "pros": "", "cons": "",
                "cost": {"total_cost": round(route_km * 350000), "cost_per_km": 350000,
                         "fiber_cable": 0, "civil_work": 0, "splice_closures": 0,
                         "testing_survey": 0, "permits": 0, "subtotal": 0, "contingency": 0, "gst": 0},
            })
        return {
            "origin": {"lat": olat, "lon": olon},
            "destination": {"lat": dlat, "lon": dlon},
            "straight_line_km": round(km, 2),
            "routes": routes, "total_routes": len(routes),
            "recommended_route": "route_1",
        }
