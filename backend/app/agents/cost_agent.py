"""Cost Estimation Agent v3 — Full BOQ with Indian market pricing in ₹.

Generates a complete Bill of Quantities with:
- Item-level hardware counts and unit prices
- Civil works costs based on terrain
- Labor breakdown
- Permits & regulatory costs
- OPEX estimation (annual)
- GST and contingency
All prices in Indian Rupees (₹).
"""
import json
import logging
import math
from pathlib import Path

logger = logging.getLogger(__name__)
DATA_DIR = Path(__file__).parent.parent / "data"


class CostAgent:
    """Full BOQ cost model with Indian market hardware pricing."""

    def __init__(self):
        with open(DATA_DIR / "hardware_catalog_inr.json") as f:
            self.catalog_data = json.load(f)
        with open(DATA_DIR / "terrain_data.json") as f:
            self.terrain_data = json.load(f)

        self.catalog = self.catalog_data["catalog"]
        self.gst_pct = self.catalog_data.get("gst_percent", 18)
        self.contingency_pct = self.catalog_data.get("contingency_percent", 12)

    async def execute(
        self,
        route_length_km: float,
        premises: int,
        terrain_type: str = "urban",
        timeline: str = "standard",
    ) -> dict:
        boq = []
        is_aerial = terrain_type in ("rural", "mountainous")

        # ── 1. FIBER CABLE ──
        if premises > 1000:
            feeder = self.catalog["fiber_cable"]["single_mode_48core_per_km"]
        else:
            feeder = self.catalog["fiber_cable"]["single_mode_24core_per_km"]
        boq.append(self._line(feeder["name"], math.ceil(route_length_km), feeder["unit"], feeder["price_inr"], "Fiber Cable"))

        dist_cable = self.catalog["fiber_cable"]["single_mode_24core_per_km"]
        dist_km = max(1, math.ceil(route_length_km * 0.3))
        boq.append(self._line(dist_cable["name"] + " (Distribution)", dist_km, dist_cable["unit"], dist_cable["price_inr"], "Fiber Cable"))

        drop = self.catalog["fiber_cable"]["drop_cable_per_unit"]
        boq.append(self._line(drop["name"], premises, drop["unit"], drop["price_inr"], "Fiber Cable"))

        # ── 2. ACTIVE EQUIPMENT ──
        if premises > 2000:
            olt = self.catalog["active_equipment"]["olt_16port"]
            olt_count = max(1, math.ceil(premises / 2000))
        else:
            olt = self.catalog["active_equipment"]["olt_8port"]
            olt_count = max(1, math.ceil(premises / 500))
        boq.append(self._line(olt["name"], olt_count, olt["unit"], olt["price_inr"], "Active Equipment", olt.get("capacity", "")))

        ont = self.catalog["active_equipment"]["ont_wifi"]
        boq.append(self._line(ont["name"], premises, ont["unit"], ont["price_inr"], "Active Equipment"))

        l3 = self.catalog["active_equipment"]["l3_switch"]
        l3_count = max(1, math.ceil(premises / 2000))
        boq.append(self._line(l3["name"], l3_count, l3["unit"], l3["price_inr"], "Active Equipment"))

        router = self.catalog["active_equipment"]["core_router"]
        boq.append(self._line(router["name"], 1, router["unit"], router["price_inr"], "Active Equipment"))

        # ── 3. PASSIVE EQUIPMENT ──
        splitter32 = self.catalog["passive_equipment"]["splitter_1x32"]
        splitter32_count = max(1, math.ceil(premises / 32))
        boq.append(self._line(splitter32["name"], splitter32_count, splitter32["unit"], splitter32["price_inr"], "Passive Equipment"))

        splitter8 = self.catalog["passive_equipment"]["splitter_1x8"]
        splitter8_count = max(1, math.ceil(premises / 256))
        boq.append(self._line(splitter8["name"], splitter8_count, splitter8["unit"], splitter8["price_inr"], "Passive Equipment"))

        closure = self.catalog["passive_equipment"]["splice_closure"]
        closure_count = max(2, math.ceil(route_length_km * 2))
        boq.append(self._line(closure["name"], closure_count, closure["unit"], closure["price_inr"], "Passive Equipment"))

        fdb = self.catalog["passive_equipment"]["fdb_box_16port"]
        fdb_count = max(1, math.ceil(premises / 16))
        boq.append(self._line(fdb["name"], fdb_count, fdb["unit"], fdb["price_inr"], "Passive Equipment"))

        ppanel = self.catalog["passive_equipment"]["patch_panel_24port"]
        boq.append(self._line(ppanel["name"], olt_count, ppanel["unit"], ppanel["price_inr"], "Passive Equipment"))

        pcord = self.catalog["passive_equipment"]["patch_cord_sc_apc"]
        boq.append(self._line(pcord["name"], premises, pcord["unit"], pcord["price_inr"], "Passive Equipment"))

        # ── 4. CIVIL INFRASTRUCTURE ──
        if is_aerial:
            pole = self.catalog["civil_infrastructure"]["pole_9m_steel"]
            pole_count = max(2, math.ceil(route_length_km * 1000 / 60))
            boq.append(self._line(pole["name"], pole_count, pole["unit"], pole["price_inr"], "Civil Infrastructure"))
        else:
            duct = self.catalog["civil_infrastructure"]["hdpe_duct_40mm_per_km"]
            boq.append(self._line(duct["name"], math.ceil(route_length_km), duct["unit"], duct["price_inr"], "Civil Infrastructure"))
            manhole = self.catalog["civil_infrastructure"]["manhole_chamber"]
            manhole_count = max(2, math.ceil(route_length_km * 1000 / 400))
            boq.append(self._line(manhole["name"], manhole_count, manhole["unit"], manhole["price_inr"], "Civil Infrastructure"))

        cabinet = self.catalog["civil_infrastructure"]["outdoor_cabinet"]
        cabinet_count = max(1, math.ceil(premises / 500))
        boq.append(self._line(cabinet["name"], cabinet_count, cabinet["unit"], cabinet["price_inr"], "Civil Infrastructure"))

        rack = self.catalog["civil_infrastructure"]["server_rack_42u"]
        boq.append(self._line(rack["name"], 1, rack["unit"], rack["price_inr"], "Civil Infrastructure"))

        # ── 5. LABOR ──
        labor = self.catalog["labor_rates"]
        if is_aerial:
            s = labor["aerial_stringing_per_km"]
            boq.append(self._line(s["name"], math.ceil(route_length_km), s["unit"], s["price_inr"], "Labor"))
        else:
            k = "trenching_rural_per_km" if terrain_type == "rural" else "trenching_urban_per_km"
            t = labor[k]
            boq.append(self._line(t["name"], math.ceil(route_length_km), t["unit"], t["price_inr"], "Labor"))

        splice = labor["fiber_splicing_per_joint"]
        splice_count = closure_count * 24 + splitter32_count * 2
        boq.append(self._line(splice["name"], splice_count, splice["unit"], splice["price_inr"], "Labor"))

        inst = labor["ont_installation_per_premise"]
        boq.append(self._line(inst["name"], premises, inst["unit"], inst["price_inr"], "Labor"))

        test = labor["otdr_testing_per_km"]
        boq.append(self._line(test["name"], math.ceil(route_length_km), test["unit"], test["price_inr"], "Labor"))

        surv = labor["survey_design_per_km"]
        boq.append(self._line(surv["name"], math.ceil(route_length_km), surv["unit"], surv["price_inr"], "Labor"))

        # ── 6. PERMITS ──
        permits = self.catalog["permits_regulatory"]
        rp = permits["road_cutting_urban" if terrain_type == "urban" else "road_cutting_rural"]
        boq.append(self._line(rp["name"], math.ceil(route_length_km), rp["unit"], rp["price_inr"], "Permits & Regulatory"))
        dl = permits["dot_license"]
        boq.append(self._line(dl["name"], 1, dl["unit"], dl["price_inr"], "Permits & Regulatory"))

        # ── TOTALS ──
        capex_sub = sum(i["total_inr"] for i in boq)
        contingency = round(capex_sub * self.contingency_pct / 100)
        gst = round(capex_sub * self.gst_pct / 100)
        timeline_mult = {"urgent": 1.30, "standard": 1.0, "long-term": 0.92}.get(timeline, 1.0)
        total_capex = round((capex_sub + contingency + gst) * timeline_mult)

        cats = {}
        for i in boq:
            cats[i["category"]] = cats.get(i["category"], 0) + i["total_inr"]

        # OPEX
        opex = self.catalog["opex_annual"]
        annual_opex = (
            cabinet_count * opex["electricity_per_cabinet"]["price_inr"]
            + math.ceil(route_length_km) * opex["maintenance_per_km"]["price_inr"]
            + 2 * opex["noc_staff_per_month"]["price_inr"] * 12
            + opex["software_license_annual"]["price_inr"]
        )

        result = {
            "currency": "INR",
            "total_cost": total_capex,
            "total_cost_usd": round(total_capex / self.catalog_data.get("exchange_rate_usd_to_inr", 83.5)),
            "cost_per_premise": round(total_capex / max(premises, 1)),
            "cost_per_km": round(total_capex / max(route_length_km, 0.1)),
            "breakdown": {
                "fiber_materials": cats.get("Fiber Cable", 0),
                "active_equipment": cats.get("Active Equipment", 0),
                "passive_equipment": cats.get("Passive Equipment", 0),
                "civil_infrastructure": cats.get("Civil Infrastructure", 0),
                "labor": cats.get("Labor", 0),
                "permits": cats.get("Permits & Regulatory", 0),
                "contingency": contingency,
                "gst": gst,
                "timeline_adjustment": f"{(timeline_mult - 1) * 100:+.0f}%",
            },
            "boq": boq,
            "hardware_summary": {
                "olt_count": olt_count, "olt_model": olt["name"],
                "ont_count": premises, "ont_model": ont["name"],
                "splitter_1x32_count": splitter32_count,
                "splitter_1x8_count": splitter8_count,
                "fdb_count": fdb_count,
                "splice_closure_count": closure_count,
                "l3_switch_count": l3_count,
                "core_router_count": 1,
                "cabinet_count": cabinet_count,
                "total_hardware_items": sum(i["quantity"] for i in boq if i["category"] in ("Active Equipment", "Passive Equipment")),
            },
            "capex_subtotal": capex_sub,
            "contingency_percent": self.contingency_pct,
            "gst_percent": self.gst_pct,
            "annual_opex": annual_opex,
            "terrain_type": terrain_type,
            "terrain_multiplier": self.terrain_data.get("terrain_multipliers", {}).get(terrain_type, 1.3),
            "timeline_multiplier": timeline_mult,
            "deployment_method": "aerial" if is_aerial else "underground",
        }

        logger.info(f"BOQ: ₹{total_capex:,.0f} ({len(boq)} items), {premises} premises, {route_length_km:.1f} km")
        return result

    def _line(self, name, qty, unit, price, category, note=""):
        return {"item_name": name, "quantity": qty, "unit": unit, "unit_price_inr": price, "total_inr": qty * price, "category": category, "note": note}
