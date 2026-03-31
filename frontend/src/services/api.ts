/**
 * ATLAS v2 API Service
 * Typed API client for the ATLAS backend
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// --- Types ---

export interface PlanningRequest {
  location: string;
  premises?: number;
  budget: number;
  timeline: "urgent" | "standard" | "long-term";
  priority: "market-expansion" | "rural-connectivity" | "competitive-defense";
  terrain_type?: "urban" | "suburban" | "rural" | "mountainous";
  source_lat?: number;
  source_lon?: number;
  polygon?: [number, number][]; // [[lat,lon], [lat,lon], ...]
}

export interface LatLon {
  lat: number;
  lon: number;
}

export interface RouteEdge {
  from: LatLon;
  to: LatLon;
  length_m: number;
}

export interface AreaAnalysis {
  area_sq_km: number;
  detected_buildings: number;
  building_source: string;
  building_centroids_used: number;
  polygon_vertices: number;
  center?: { lat: number; lon: number };
}

export interface RouteResult {
  route_length_km: number;
  sampled_route_km: number;
  total_edges: number;
  total_nodes: number;
  premises_connected: number;
  premises_sampled: number;
  source_node: LatLon | null;
  route_edges: RouteEdge[];
  strategy: string;
  area_analysis?: AreaAnalysis | null;
  error?: string;
}

export interface CostBreakdown {
  fiber_materials: number;
  active_equipment: number;
  passive_equipment: number;
  civil_infrastructure: number;
  labor: number;
  permits: number;
  contingency: number;
  gst: number;
  timeline_adjustment: string;
  [key: string]: number | string; // for any extra categories
}

export interface BOQItem {
  item_name: string;
  quantity: number;
  unit: string;
  unit_price_inr: number;
  total_inr: number;
  category: string;
  note: string;
}

export interface HardwareSummary {
  olt_count: number;
  olt_model: string;
  ont_count: number;
  ont_model: string;
  splitter_1x32_count: number;
  splitter_1x8_count: number;
  fdb_count: number;
  splice_closure_count: number;
  l3_switch_count: number;
  core_router_count: number;
  cabinet_count: number;
  total_hardware_items: number;
}

export interface CostResult {
  currency: string;
  total_cost: number;
  total_cost_usd?: number;
  cost_per_premise: number;
  cost_per_km: number;
  breakdown: CostBreakdown;
  boq: BOQItem[];
  hardware_summary: HardwareSummary;
  capex_subtotal: number;
  contingency_percent: number;
  gst_percent: number;
  annual_opex: number;
  terrain_type: string;
  terrain_multiplier: number;
  timeline_multiplier: number;
  deployment_method: string;
}

export interface RiskItem {
  risk_type: string;
  score: number;
  severity: "high" | "medium" | "low";
  description: string;
  mitigation: string;
}

export interface RiskResult {
  overall_risk_score: number;
  overall_severity: string;
  risk_count: { high: number; medium: number; low: number };
  risks: RiskItem[];
}

export interface ScenarioItem {
  id: string;
  name: string;
  description: string;
  estimated_cost: number;
  cost_per_premise: number;
  premises_connected: number;
  coverage_percent: number;
  estimated_months: number;
  risk_tolerance: string;
  within_budget: boolean;
  priority_score: number;
  route_length_km: number;
  topsis_score?: number;
  rank?: number;
}

export interface ScenarioResult {
  scenarios: ScenarioItem[];
  recommended: string;
  total_generated: number;
}

export interface DecisionResult {
  recommended_scenario: ScenarioItem;
  all_rankings: ScenarioItem[];
  decision_weights: Record<string, number>;
  priority: string;
  reasoning: string;
}

export interface ExplanationSection {
  title: string;
  content: string;
}

export interface ExplanationResult {
  summary: string;
  sections: ExplanationSection[];
  confidence: string;
  recommended_scenario: string;
}

export interface PlanningResponse {
  status: string;
  pipeline_duration_seconds: number;
  route: RouteResult;
  cost: CostResult;
  risk: RiskResult;
  scenarios: ScenarioResult;
  decision: DecisionResult;
  explanation: ExplanationResult;
}

// --- API Functions ---

export async function runPlanningAgents(data: PlanningRequest): Promise<PlanningResponse> {
  const token = localStorage.getItem('atlas_token');
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/v1/plan`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `API error: ${response.status}`);
  }

  return response.json();
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getScenarioTemplates(): Promise<{
  templates: Array<{ id: string; name: string; description: string }>;
}> {
  const res = await fetch(`${API_BASE}/api/v1/scenarios/templates`);
  return res.json();
}

export async function getRiskFactors(): Promise<{
  factors: Array<{ id: string; base_score: number }>;
}> {
  const res = await fetch(`${API_BASE}/api/v1/risk/factors`);
  return res.json();
}
