"""Pydantic schemas for API request and response validation."""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from enum import Enum


# --- Enums ---

class TimelineType(str, Enum):
    URGENT = "urgent"
    STANDARD = "standard"
    LONG_TERM = "long-term"


class PriorityType(str, Enum):
    MARKET_EXPANSION = "market-expansion"
    RURAL_CONNECTIVITY = "rural-connectivity"
    COMPETITIVE_DEFENSE = "competitive-defense"


class TerrainType(str, Enum):
    URBAN = "urban"
    SUBURBAN = "suburban"
    RURAL = "rural"
    MOUNTAINOUS = "mountainous"


# --- Request ---

class PlanningRequest(BaseModel):
    location: str = Field(default="Custom Area", min_length=1, max_length=200,
                          description="City, area, or place name for deployment")
    premises: Optional[int] = Field(None, gt=0, le=100000,
                          description="Number of premises (auto-detected if polygon given)")
    budget: float = Field(..., gt=0,
                          description="Total budget in INR")
    timeline: TimelineType = Field(default=TimelineType.STANDARD)
    priority: PriorityType = Field(default=PriorityType.MARKET_EXPANSION)
    terrain_type: TerrainType = Field(default=TerrainType.URBAN)
    source_lat: Optional[float] = Field(None, ge=-90, le=90,
                                         description="Central Office latitude")
    source_lon: Optional[float] = Field(None, ge=-180, le=180,
                                         description="Central Office longitude")
    polygon: Optional[list[list[float]]] = Field(None,
                          description="Deployment area polygon as [[lat,lon], [lat,lon], ...]. If provided, premises are auto-detected from building footprints.")


# --- Response sub-models ---

class LatLon(BaseModel):
    lat: float
    lon: float


class RouteEdge(BaseModel):
    from_point: LatLon = Field(alias="from")
    to_point: LatLon = Field(alias="to")
    length_m: float

    class Config:
        populate_by_name = True


class RouteResult(BaseModel):
    route_length_km: float
    total_edges: int = 0
    total_nodes: int = 0
    premises_connected: int = 0
    source_node: Optional[LatLon] = None
    route_edges: List[RouteEdge] = []
    strategy: str = "steiner_tree"
    error: Optional[str] = None


class CostBreakdown(BaseModel):
    fiber_materials: float
    labor: float
    permits: float
    equipment: float
    premise_connections: float
    testing: float
    timeline_adjustment: str


class CostResult(BaseModel):
    total_cost: float
    cost_per_premise: float
    cost_per_km: float
    breakdown: CostBreakdown
    terrain_type: str
    terrain_multiplier: float
    timeline_multiplier: float


class RiskItem(BaseModel):
    risk_type: str
    score: float
    severity: str
    description: str
    mitigation: str


class RiskResult(BaseModel):
    overall_risk_score: float
    overall_severity: str
    risk_count: dict
    risks: list[RiskItem]


class ScenarioItem(BaseModel):
    id: str
    name: str
    description: str
    estimated_cost: float
    cost_per_premise: float
    premises_connected: int
    coverage_percent: float
    estimated_months: int
    risk_tolerance: str
    within_budget: bool
    priority_score: float
    route_length_km: float
    topsis_score: Optional[float] = None
    rank: Optional[int] = None


class ScenarioResult(BaseModel):
    scenarios: list[ScenarioItem]
    recommended: str
    total_generated: int


class DecisionResult(BaseModel):
    recommended_scenario: ScenarioItem
    all_rankings: list[ScenarioItem]
    decision_weights: dict
    priority: str
    reasoning: str


class ExplanationSection(BaseModel):
    title: str
    content: str


class ExplanationResult(BaseModel):
    summary: str
    sections: list[ExplanationSection]
    confidence: str
    recommended_scenario: str


# --- Full response ---

class PlanningResponse(BaseModel):
    status: str
    route: RouteResult
    cost: CostResult
    risk: RiskResult
    scenarios: ScenarioResult
    decision: DecisionResult
    explanation: ExplanationResult

    class Config:
        populate_by_name = True
