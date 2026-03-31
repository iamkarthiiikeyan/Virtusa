"""Explainability Agent — Generates human-readable decision explanations.

Replaces the f-string template with structured, contextual explanations
that map directly to frontend visualization sections.
"""
import logging

logger = logging.getLogger(__name__)


class ExplainabilityAgent:
    """Produces structured explanations for the full planning pipeline."""

    async def execute(
        self,
        geo_result: dict,
        cost_result: dict,
        risk_result: dict,
        scenario_result: dict,
        negotiation_result: dict,
        request_params: dict,
    ) -> dict:
        recommended = negotiation_result.get("recommended_scenario", {})
        sections = []

        # --- Route Analysis ---
        strategy_names = {
            "steiner_tree": "Steiner Tree optimization",
            "fallback_estimation": "statistical estimation (geospatial data unavailable)",
        }
        strategy_label = strategy_names.get(
            geo_result.get("strategy", ""), geo_result.get("strategy", "unknown")
        )

        route_section = (
            f"Analyzed the road network for '{request_params.get('location', 'the selected area')}' "
            f"and computed an optimized fiber route of {geo_result.get('route_length_km', 0):.1f} km "
            f"using {strategy_label}. "
        )
        if geo_result.get("total_edges", 0) > 0:
            route_section += (
                f"The route uses {geo_result['total_edges']} fiber segments across "
                f"{geo_result['total_nodes']} junction points to connect "
                f"{geo_result.get('premises_connected', 0):,} premises."
            )
        if geo_result.get("premises_sampled", 0) < geo_result.get("premises_connected", 0):
            route_section += (
                f" (Sampled {geo_result['premises_sampled']} representative premises "
                f"and scaled to full deployment estimate.)"
            )

        sections.append({"title": "Route Analysis", "content": route_section})

        # --- Cost Analysis ---
        breakdown = cost_result.get("breakdown", {})
        top_costs = sorted(
            [(k, v) for k, v in breakdown.items() if isinstance(v, (int, float)) and v > 0],
            key=lambda x: x[1],
            reverse=True,
        )[:3]
        top_items = ", ".join(
            f"{k.replace('_', ' ')} (${v:,.0f})" for k, v in top_costs
        )

        cost_section = (
            f"Total estimated CAPEX: ${cost_result.get('total_cost', 0):,.0f} "
            f"(${cost_result.get('cost_per_premise', 0):,.0f} per premise, "
            f"${cost_result.get('cost_per_km', 0):,.0f} per km). "
            f"Largest cost components: {top_items}. "
            f"Terrain difficulty multiplier: {cost_result.get('terrain_multiplier', 1):.1f}x "
            f"({cost_result.get('terrain_type', 'unknown')} terrain)."
        )
        timeline_adj = breakdown.get("timeline_adjustment", "+0%")
        if timeline_adj != "+0%":
            cost_section += f" Timeline adjustment: {timeline_adj}."

        sections.append({"title": "Cost Estimation", "content": cost_section})

        # --- Risk Assessment ---
        rc = risk_result.get("risk_count", {})
        top_risks = risk_result.get("risks", [])[:3]
        risk_names = [r["risk_type"].replace("_", " ").title() for r in top_risks]

        risk_section = (
            f"Overall risk score: {risk_result.get('overall_risk_score', 0):.2f}/1.00 "
            f"({risk_result.get('overall_severity', 'unknown')}). "
            f"Identified {rc.get('high', 0)} high-severity, {rc.get('medium', 0)} medium, "
            f"and {rc.get('low', 0)} low risks. "
        )
        if top_risks:
            risk_section += f"Top concerns: {', '.join(risk_names)}. "
            risk_section += f"Primary mitigation: {top_risks[0].get('mitigation', 'N/A')}"

        sections.append({"title": "Risk Assessment", "content": risk_section})

        # --- Scenario Comparison ---
        total_scenarios = scenario_result.get("total_generated", 0)
        feasible = sum(1 for s in scenario_result.get("scenarios", []) if s.get("within_budget"))
        scenario_section = (
            f"Generated {total_scenarios} deployment scenarios. "
            f"{feasible} of {total_scenarios} are within the stated budget of "
            f"${request_params.get('budget', 0):,.0f}. "
        )
        if total_scenarios > 0:
            costs = [s["estimated_cost"] for s in scenario_result["scenarios"]]
            scenario_section += (
                f"Cost range: ${min(costs):,.0f} to ${max(costs):,.0f}."
            )

        sections.append({"title": "Scenario Comparison", "content": scenario_section})

        # --- Decision Rationale ---
        sections.append({
            "title": "Recommendation Rationale",
            "content": negotiation_result.get("reasoning", "No reasoning available."),
        })

        # --- Summary ---
        summary = (
            f"ATLAS recommends the '{recommended.get('name', 'N/A')}' scenario "
            f"with an estimated cost of ${recommended.get('estimated_cost', 0):,.0f}, "
            f"{recommended.get('coverage_percent', 0):.0f}% premises coverage, "
            f"and a {recommended.get('estimated_months', 0)}-month deployment timeline. "
        )
        if recommended.get("within_budget"):
            summary += "This plan is within the stated budget."
        else:
            summary += "Note: This plan exceeds the stated budget — consider adjusting scope or budget."

        confidence = "high" if recommended.get("within_budget") else "medium"
        if risk_result.get("overall_severity") == "high":
            confidence = "medium" if confidence == "high" else "low"

        result = {
            "summary": summary,
            "sections": sections,
            "confidence": confidence,
            "recommended_scenario": recommended.get("name", "N/A"),
        }

        logger.info(f"Explanation generated: confidence={confidence}")
        return result
