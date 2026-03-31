"""Scenario Simulation Agent — Generates multiple deployment strategies.

Generates 5 distinct scenarios along cost/time/coverage/risk axes.
Each priority genuinely favors different scenarios:
  - market-expansion → favors Maximum Coverage
  - rural-connectivity → favors Phased Rollout or Lowest Cost
  - competitive-defense → favors Fastest Deployment
  - cost-optimization → favors Lowest Cost
"""
import logging

logger = logging.getLogger(__name__)


class ScenarioAgent:
    """Generates multiple deployment scenarios for comparison."""

    TEMPLATES = {
        "lowest_cost": {
            "name": "Lowest Cost Deployment",
            "description": "Minimizes total CAPEX by extending timeline, accepting higher risk, and targeting 85% coverage",
            "timeline_mult": 1.3,
            "coverage": 0.85,
            "cost_mult": 0.80,
            "risk_tolerance": "high",
        },
        "fastest_deployment": {
            "name": "Fastest Deployment",
            "description": "Minimizes time-to-completion with premium resources, parallel crews, and expedited permits",
            "timeline_mult": 0.6,
            "coverage": 0.90,
            "cost_mult": 1.35,
            "risk_tolerance": "low",
        },
        "balanced": {
            "name": "Balanced Approach",
            "description": "Optimal balance of cost, speed, coverage, and risk for most deployments",
            "timeline_mult": 1.0,
            "coverage": 0.95,
            "cost_mult": 1.0,
            "risk_tolerance": "medium",
        },
        "maximum_coverage": {
            "name": "Maximum Coverage",
            "description": "Connects every premise including high-cost edge cases, regardless of marginal cost",
            "timeline_mult": 1.15,
            "coverage": 1.0,
            "cost_mult": 1.25,
            "risk_tolerance": "medium",
        },
        "phased_rollout": {
            "name": "Phased Rollout (3 phases)",
            "description": "Deploys in 3 phases starting with highest-density areas for fastest subscriber revenue",
            "timeline_mult": 1.5,
            "coverage": 0.95,
            "cost_mult": 0.92,
            "risk_tolerance": "low",
        },
    }

    async def execute(
        self,
        base_cost: float,
        premises: int,
        route_length_km: float,
        risk_data: dict,
        budget: float,
        timeline: str,
        priority: str,
    ) -> dict:
        base_months = {"urgent": 6, "standard": 12, "long-term": 18}.get(timeline, 12)

        scenarios = []
        for key, t in self.TEMPLATES.items():
            adjusted_cost = base_cost * t["cost_mult"]
            connected = int(premises * t["coverage"])
            cost_per_premise = adjusted_cost / max(connected, 1)
            months = max(3, int(base_months * t["timeline_mult"]))

            priority_score = self._score_priority(
                key, priority, adjusted_cost, budget, t["coverage"], months, base_months
            )

            scenarios.append({
                "id": key,
                "name": t["name"],
                "description": t["description"],
                "estimated_cost": round(adjusted_cost, 2),
                "cost_per_premise": round(cost_per_premise, 2),
                "premises_connected": connected,
                "coverage_percent": round(t["coverage"] * 100, 1),
                "estimated_months": months,
                "risk_tolerance": t["risk_tolerance"],
                "within_budget": adjusted_cost <= budget,
                "priority_score": round(priority_score, 2),
                "route_length_km": round(route_length_km * t["coverage"], 2),
            })

        scenarios.sort(key=lambda s: s["priority_score"], reverse=True)

        result = {
            "scenarios": scenarios,
            "recommended": scenarios[0]["id"],
            "total_generated": len(scenarios),
        }

        logger.info(
            f"Generated {len(scenarios)} scenarios, recommended: {scenarios[0]['name']}"
        )
        return result

    def _score_priority(self, scenario_key, priority, cost, budget, coverage, months, base_months):
        """Score each scenario based on the user's stated priority.

        Key design: each priority has ONE primary dimension that dominates.
        This prevents 'fastest' from always winning regardless of priority.

        Scoring breakdown per priority:
          market-expansion:    coverage (40) + speed (15) + budget (15) = 70 max from factors
          rural-connectivity:  cost_efficiency (35) + coverage (25) + phased_bonus (15) = 75
          competitive-defense: speed (40) + coverage (15) + budget (10) = 65
          cost-optimization:   cost_efficiency (45) + budget (25) = 70
        """
        score = 30.0  # base

        if priority == "market-expansion":
            # Primary: coverage (reach as many premises as possible)
            score += coverage * 40  # 0.85→34, 0.95→38, 1.0→40
            # Secondary: speed matters but doesn't dominate
            speed_factor = max(0, (base_months - months)) / max(base_months, 1)
            score += speed_factor * 15
            # Budget
            if cost <= budget:
                score += 15
            elif cost <= budget * 1.15:
                score += 5
            else:
                score -= 10

        elif priority == "rural-connectivity":
            # Primary: cost efficiency (rural = budget-constrained)
            if cost <= budget * 0.8:
                score += 35
            elif cost <= budget:
                score += 25
            elif cost <= budget * 1.1:
                score += 10
            else:
                score -= 15
            # Secondary: coverage
            score += coverage * 25
            # Bonus for phased (start revenue early) and lowest cost
            if scenario_key == "phased_rollout":
                score += 15
            elif scenario_key == "lowest_cost":
                score += 12

        elif priority == "competitive-defense":
            # Primary: speed (beat competitors to market)
            speed_factor = max(0, (base_months - months)) / max(base_months, 1)
            score += speed_factor * 40  # fastest gets ~40, others much less
            # Secondary: coverage
            score += coverage * 15
            # Budget check
            if cost <= budget:
                score += 10
            elif cost > budget * 1.2:
                score -= 15

        else:  # cost-optimization (default)
            # Primary: minimize cost
            if cost <= budget * 0.7:
                score += 45
            elif cost <= budget * 0.85:
                score += 35
            elif cost <= budget:
                score += 20
            elif cost <= budget * 1.1:
                score += 5
            else:
                score -= 20
            # Budget headroom bonus
            if cost < budget:
                headroom = (budget - cost) / budget
                score += headroom * 25

        return max(0, min(100, score))
