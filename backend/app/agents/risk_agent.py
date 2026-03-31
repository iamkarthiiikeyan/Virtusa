"""Risk Prediction Agent — Rule-based risk scoring with contextual analysis.

Replaces `random.choice()` with deterministic, explainable risk predictions
based on deployment parameters and known telecom risk factors.
"""
import logging

logger = logging.getLogger(__name__)


class RiskAgent:
    """Deterministic risk prediction using deployment context and rules."""

    RISK_RULES = {
        "permit_delay": {
            "base_score": 0.30,
            "modifiers": {
                "terrain:urban": 0.25,
                "terrain:suburban": 0.10,
                "terrain:rural": -0.10,
                "terrain:mountainous": 0.15,
                "timeline:urgent": 0.20,
                "timeline:long-term": -0.10,
                "scale:large": 0.10,   # >5000 premises
            },
        },
        "terrain_difficulty": {
            "base_score": 0.20,
            "modifiers": {
                "terrain:urban": -0.05,
                "terrain:suburban": 0.05,
                "terrain:rural": 0.15,
                "terrain:mountainous": 0.45,
            },
        },
        "weather_disruption": {
            "base_score": 0.15,
            "modifiers": {
                "timeline:long-term": 0.20,
                "timeline:urgent": -0.05,
                "terrain:coastal": 0.25,
                "terrain:mountainous": 0.15,
            },
        },
        "resource_shortage": {
            "base_score": 0.20,
            "modifiers": {
                "scale:large": 0.25,
                "scale:very_large": 0.35,  # >10000 premises
                "timeline:urgent": 0.25,
                "timeline:long-term": -0.10,
            },
        },
        "cost_overrun": {
            "base_score": 0.25,
            "modifiers": {
                "budget:tight": 0.30,      # budget < $500/premise
                "budget:very_tight": 0.40,  # budget < $300/premise
                "terrain:urban": 0.15,
                "terrain:mountainous": 0.20,
                "timeline:urgent": 0.15,
            },
        },
        "infrastructure_conflict": {
            "base_score": 0.15,
            "modifiers": {
                "terrain:urban": 0.25,
                "terrain:suburban": 0.10,
                "terrain:rural": -0.10,
                "terrain:mountainous": -0.05,
            },
        },
    }

    DESCRIPTIONS = {
        "permit_delay": {
            "high": "Significant permit processing delays expected due to regulatory complexity in this area",
            "medium": "Moderate permit delays possible; standard processing timeline may slip by 2-4 weeks",
            "low": "Permit process expected to proceed normally within standard timelines",
        },
        "terrain_difficulty": {
            "high": "Challenging terrain will significantly increase construction difficulty and cost",
            "medium": "Some terrain obstacles may slow deployment in certain sections",
            "low": "Terrain is favorable for fiber deployment with standard construction methods",
        },
        "weather_disruption": {
            "high": "High probability of weather-related construction delays, especially during monsoon/winter",
            "medium": "Weather may cause occasional delays; build seasonal buffer into schedule",
            "low": "Weather conditions expected to be favorable for the deployment window",
        },
        "resource_shortage": {
            "high": "Likely shortage of skilled labor and specialized equipment at this scale",
            "medium": "Resource availability may be constrained; secure commitments early",
            "low": "Sufficient resources expected to be available in the market",
        },
        "cost_overrun": {
            "high": "Budget is very tight for the scope; significant risk of cost overrun (>20%)",
            "medium": "Some cost overrun risk (10-15%); build contingency into budget",
            "low": "Budget appears adequate for the scope with standard contingency",
        },
        "infrastructure_conflict": {
            "high": "Dense underground utilities create high risk of conflicts during trenching",
            "medium": "Some utility conflicts expected; conduct utility surveys before construction",
            "low": "Low likelihood of infrastructure conflicts in the deployment area",
        },
    }

    MITIGATIONS = {
        "permit_delay": "Pre-file permits 60 days ahead; engage local government liaison; batch permit submissions for efficiency",
        "terrain_difficulty": "Conduct pre-deployment site survey; use directional boring for difficult terrain; consider aerial deployment where possible",
        "weather_disruption": "Build 3-4 week weather buffer into schedule; prioritize indoor/covered work during poor weather windows",
        "resource_shortage": "Secure contractor commitments 90 days early; consider phased deployment to spread resource demand; maintain backup vendor list",
        "cost_overrun": "Add 15-20% contingency to budget; lock vendor pricing with contracts; use value engineering for non-critical route sections",
        "infrastructure_conflict": "Obtain utility maps from all providers; use ground-penetrating radar for survey; pothole before trenching in dense areas",
    }

    async def execute(
        self,
        location: str,
        premises: int,
        budget: float,
        timeline: str,
        route_length_km: float,
        terrain_type: str = "urban",
    ) -> dict:
        # Build context tags for modifier lookup
        tags = set()
        tags.add(f"terrain:{terrain_type}")
        tags.add(f"timeline:{timeline}")

        if premises > 10000:
            tags.add("scale:very_large")
            tags.add("scale:large")
        elif premises > 5000:
            tags.add("scale:large")

        budget_per_premise = budget / max(premises, 1)
        if budget_per_premise < 300:
            tags.add("budget:very_tight")
            tags.add("budget:tight")
        elif budget_per_premise < 500:
            tags.add("budget:tight")

        # Score each risk
        risks = []
        for risk_name, rules in self.RISK_RULES.items():
            score = rules["base_score"]

            for tag, modifier in rules["modifiers"].items():
                if tag in tags:
                    score += modifier

            score = max(0.0, min(1.0, round(score, 2)))
            severity = "high" if score > 0.55 else "medium" if score > 0.30 else "low"

            risks.append({
                "risk_type": risk_name,
                "score": score,
                "severity": severity,
                "description": self.DESCRIPTIONS.get(risk_name, {}).get(
                    severity, "Risk assessment pending"
                ),
                "mitigation": self.MITIGATIONS.get(risk_name, "Monitor and reassess"),
            })

        risks.sort(key=lambda r: r["score"], reverse=True)

        overall_score = round(sum(r["score"] for r in risks) / len(risks), 2)
        overall_severity = (
            "high" if overall_score > 0.50
            else "medium" if overall_score > 0.30
            else "low"
        )

        result = {
            "overall_risk_score": overall_score,
            "overall_severity": overall_severity,
            "risk_count": {
                "high": sum(1 for r in risks if r["severity"] == "high"),
                "medium": sum(1 for r in risks if r["severity"] == "medium"),
                "low": sum(1 for r in risks if r["severity"] == "low"),
            },
            "risks": risks,
        }

        logger.info(
            f"Risk assessed: overall={overall_score:.2f} ({overall_severity}), "
            f"high={result['risk_count']['high']}, medium={result['risk_count']['medium']}"
        )
        return result
