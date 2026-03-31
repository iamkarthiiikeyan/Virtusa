"""Planning Pipeline — Orchestrates the full AI agent workflow.

Replaces the flat function-call chain with a proper async pipeline
that passes typed state between agents.
"""
import logging
import time

from app.agents.geospatial_agent import GeospatialAgent
from app.agents.cost_agent import CostAgent
from app.agents.risk_agent import RiskAgent
from app.agents.scenario_agent import ScenarioAgent
from app.agents.negotiation_agent import NegotiationAgent
from app.agents.explainability_agent import ExplainabilityAgent

logger = logging.getLogger(__name__)


class PlanningPipeline:
    """Orchestrates the sequential execution of all planning agents."""

    def __init__(self):
        self.geo_agent = GeospatialAgent()
        self.cost_agent = CostAgent()
        self.risk_agent = RiskAgent()
        self.scenario_agent = ScenarioAgent()
        self.negotiation_agent = NegotiationAgent()
        self.explain_agent = ExplainabilityAgent()

    async def run(self, request) -> dict:
        start = time.time()
        logger.info(
            f"Pipeline started: {request.location}, "
            f"{request.premises} premises, ${request.budget:,.0f} budget"
        )

        # Step 1: Geospatial Route Optimization
        logger.info("Step 1/6: Geospatial analysis...")
        geo_result = await self.geo_agent.execute(
            location=request.location,
            premises_count=getattr(request, "premises", None),
            source_lat=getattr(request, "source_lat", None),
            source_lon=getattr(request, "source_lon", None),
            polygon=getattr(request, "polygon", None),
            terrain_type=getattr(request, "terrain_type", "urban"),
        )

        # Use detected premises count if user didn't specify
        actual_premises = geo_result.get("premises_connected", request.premises or 100)

        # Step 2: Cost Estimation
        logger.info("Step 2/6: Cost estimation...")
        cost_result = await self.cost_agent.execute(
            route_length_km=geo_result["route_length_km"],
            premises=actual_premises,
            terrain_type=getattr(request, "terrain_type", "urban"),
            timeline=request.timeline,
        )

        # Step 3: Risk Prediction
        logger.info("Step 3/6: Risk prediction...")
        risk_result = await self.risk_agent.execute(
            location=request.location,
            premises=actual_premises,
            budget=request.budget,
            timeline=request.timeline,
            route_length_km=geo_result["route_length_km"],
            terrain_type=getattr(request, "terrain_type", "urban"),
        )

        # Step 4: Scenario Generation
        logger.info("Step 4/6: Scenario simulation...")
        scenario_result = await self.scenario_agent.execute(
            base_cost=cost_result["total_cost"],
            premises=actual_premises,
            route_length_km=geo_result["route_length_km"],
            risk_data=risk_result,
            budget=request.budget,
            timeline=request.timeline,
            priority=request.priority,
        )

        # Step 5: TOPSIS Multi-Criteria Decision
        logger.info("Step 5/6: Negotiation (TOPSIS)...")
        negotiation_result = await self.negotiation_agent.execute(
            scenarios=scenario_result["scenarios"],
            priority=request.priority,
            budget=request.budget,
        )

        # Step 6: Explainability
        logger.info("Step 6/6: Generating explanation...")
        explanation = await self.explain_agent.execute(
            geo_result=geo_result,
            cost_result=cost_result,
            risk_result=risk_result,
            scenario_result=scenario_result,
            negotiation_result=negotiation_result,
            request_params={
                "location": request.location,
                "premises": actual_premises,
                "budget": request.budget,
                "timeline": request.timeline,
                "priority": request.priority,
            },
        )

        elapsed = time.time() - start
        logger.info(f"Pipeline completed in {elapsed:.2f}s")

        return {
            "status": "completed",
            "pipeline_duration_seconds": round(elapsed, 2),
            "route": geo_result,
            "cost": cost_result,
            "risk": risk_result,
            "scenarios": scenario_result,
            "decision": negotiation_result,
            "explanation": explanation,
        }
