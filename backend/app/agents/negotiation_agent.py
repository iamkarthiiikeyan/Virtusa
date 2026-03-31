"""Negotiation Agent — TOPSIS multi-criteria decision analysis.

Replaces `cost * 0.9` / `cost * 1.15` with proper MCDM (Multi-Criteria
Decision Making) using the TOPSIS algorithm to rank scenarios objectively.
"""
import logging
import math

logger = logging.getLogger(__name__)


class NegotiationAgent:
    """Ranks scenarios using TOPSIS (Technique for Order of Preference
    by Similarity to Ideal Solution)."""

    PRIORITY_WEIGHTS = {
        "market-expansion": {"cost": 0.20, "time": 0.35, "coverage": 0.30, "risk": 0.15},
        "rural-connectivity": {"cost": 0.30, "time": 0.15, "coverage": 0.40, "risk": 0.15},
        "competitive-defense": {"cost": 0.15, "time": 0.40, "coverage": 0.25, "risk": 0.20},
    }

    RISK_NUMERIC = {"low": 1, "medium": 2, "high": 3}

    async def execute(self, scenarios: list, priority: str, budget: float) -> dict:
        if not scenarios:
            return {"error": "No scenarios to evaluate", "recommended_scenario": {},
                    "all_rankings": [], "decision_weights": {}, "priority": priority,
                    "reasoning": "No scenarios available"}

        weights = self.PRIORITY_WEIGHTS.get(
            priority, self.PRIORITY_WEIGHTS["market-expansion"]
        )

        n = len(scenarios)
        # Build decision matrix: [cost, time, coverage, risk]
        # cost/time/risk = minimize, coverage = maximize
        matrix = []
        for s in scenarios:
            matrix.append([
                s["estimated_cost"],
                s["estimated_months"],
                s["coverage_percent"],
                self.RISK_NUMERIC.get(s["risk_tolerance"], 2),
            ])

        # --- TOPSIS ---
        # Step 1: Normalize
        col_sums = [0.0] * 4
        for row in matrix:
            for j in range(4):
                col_sums[j] += row[j] ** 2
        norms = [math.sqrt(s) if s > 0 else 1.0 for s in col_sums]

        normalized = []
        for row in matrix:
            normalized.append([row[j] / norms[j] for j in range(4)])

        # Step 2: Apply weights
        w = [weights["cost"], weights["time"], weights["coverage"], weights["risk"]]
        weighted = []
        for row in normalized:
            weighted.append([row[j] * w[j] for j in range(4)])

        # Step 3: Ideal best and worst
        # cost(0), time(1), risk(3) → minimize; coverage(2) → maximize
        ideal_best = [
            min(r[0] for r in weighted),  # min cost
            min(r[1] for r in weighted),  # min time
            max(r[2] for r in weighted),  # max coverage
            min(r[3] for r in weighted),  # min risk
        ]
        ideal_worst = [
            max(r[0] for r in weighted),
            max(r[1] for r in weighted),
            min(r[2] for r in weighted),
            max(r[3] for r in weighted),
        ]

        # Step 4: Distance to ideal best / worst
        closeness = []
        for i, row in enumerate(weighted):
            d_best = math.sqrt(sum((row[j] - ideal_best[j]) ** 2 for j in range(4)))
            d_worst = math.sqrt(sum((row[j] - ideal_worst[j]) ** 2 for j in range(4)))
            score = d_worst / (d_best + d_worst + 1e-10)
            closeness.append(score)

        # Step 5: Rank
        rankings = []
        for i, score in enumerate(closeness):
            s = dict(scenarios[i])  # copy
            s["topsis_score"] = round(score, 4)
            s["rank"] = 0
            rankings.append(s)

        rankings.sort(key=lambda r: r["topsis_score"], reverse=True)
        for i, r in enumerate(rankings):
            r["rank"] = i + 1

        recommended = rankings[0]
        reasoning = self._build_reasoning(recommended, rankings, weights, budget)

        result = {
            "recommended_scenario": recommended,
            "all_rankings": rankings,
            "decision_weights": weights,
            "priority": priority,
            "reasoning": reasoning,
        }

        logger.info(
            f"TOPSIS decision: {recommended['name']} "
            f"(score={recommended['topsis_score']:.3f})"
        )
        return result

    def _build_reasoning(self, rec, rankings, weights, budget):
        parts = [
            f"Recommended: {rec['name']} (TOPSIS score: {rec['topsis_score']:.2f})",
        ]

        # Explain why
        top_weight = max(weights, key=weights.get)
        weight_labels = {
            "cost": "cost efficiency",
            "time": "deployment speed",
            "coverage": "coverage maximization",
            "risk": "risk minimization",
        }
        parts.append(
            f"This scenario scores highest when optimizing for {weight_labels[top_weight]} "
            f"(weight: {weights[top_weight]:.0%})."
        )

        if rec["within_budget"]:
            parts.append(f"Estimated cost ${rec['estimated_cost']:,.0f} is within the ${budget:,.0f} budget.")
        else:
            over = rec["estimated_cost"] - budget
            parts.append(
                f"Warning: Estimated cost ${rec['estimated_cost']:,.0f} exceeds budget by ${over:,.0f}. "
                f"Consider the '{rankings[1]['name']}' alternative."
            )

        parts.append(
            f"Coverage: {rec['coverage_percent']:.0f}% | "
            f"Timeline: {rec['estimated_months']} months | "
            f"Risk: {rec['risk_tolerance']}"
        )

        if len(rankings) > 1:
            r2 = rankings[1]
            parts.append(f"Runner-up: {r2['name']} (score: {r2['topsis_score']:.2f})")

        return " | ".join(parts)
