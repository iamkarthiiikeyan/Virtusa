/**
 * ATLAS Planning Store (Zustand)
 * Global state: pipeline results + user scenario selections
 */
import { create } from "zustand";
import {
  PlanningRequest,
  PlanningResponse,
  ScenarioItem,
  runPlanningAgents,
} from "../services/api";

interface PlanningStore {
  // Pipeline state
  isLoading: boolean;
  error: string | null;
  currentResult: PlanningResponse | null;
  history: PlanningResponse[];
  lastRequest: PlanningRequest | null;

  // P2P route data (stored separately so Network Planner / Digital Twin can differentiate)
  p2pRoutes: any[] | null; // all 5 routes from route comparison
  p2pMode: boolean;

  // User selections
  /** 3 scenarios selected in Scenario Simulator for Digital Twin phases */
  selectedPhaseScenarios: ScenarioItem[];
  /** 1 scenario selected for detailed Cost Intelligence view */
  selectedCostScenario: ScenarioItem | null;

  // Actions
  submitPlan: (request: PlanningRequest) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
  loadFromHistory: (index: number) => void;
  setCurrentResult: (result: any) => void;
  setP2pRoutes: (routes: any[]) => void;
  clearP2p: () => void;

  // Selection actions
  setPhaseScenarios: (scenarios: ScenarioItem[]) => void;
  togglePhaseScenario: (scenario: ScenarioItem) => void;
  setCostScenario: (scenario: ScenarioItem) => void;
}

export const usePlanningStore = create<PlanningStore>((set, get) => ({
  isLoading: false,
  error: null,
  currentResult: null,
  history: [],
  lastRequest: null,
  p2pRoutes: null,
  p2pMode: false,
  selectedPhaseScenarios: [],
  selectedCostScenario: null,

  submitPlan: async (request: PlanningRequest) => {
    set({ isLoading: true, error: null, lastRequest: request, p2pRoutes: null, p2pMode: false });
    try {
      const result = await runPlanningAgents(request);
      const top3 = result.decision.all_rankings.slice(0, 3);
      set({
        currentResult: result,
        isLoading: false,
        history: [...get().history, result],
        selectedPhaseScenarios: top3,
        selectedCostScenario: result.decision.recommended_scenario,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Planning failed. Is the backend running?",
      });
    }
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ currentResult: null, lastRequest: null, selectedPhaseScenarios: [], selectedCostScenario: null, p2pRoutes: null, p2pMode: false }),

  setCurrentResult: (result: any) => {
    const top3 = result?.decision?.all_rankings?.slice(0, 3) || [];
    set({
      currentResult: result,
      selectedPhaseScenarios: top3,
      selectedCostScenario: result?.decision?.recommended_scenario || null,
    });
  },

  setP2pRoutes: (routes: any[]) => set({ p2pRoutes: routes, p2pMode: true }),
  clearP2p: () => set({ p2pRoutes: null, p2pMode: false }),

  loadFromHistory: (index: number) => {
    const h = get().history;
    if (index >= 0 && index < h.length) {
      set({ currentResult: h[index] });
    }
  },

  setPhaseScenarios: (scenarios) => set({ selectedPhaseScenarios: scenarios.slice(0, 3) }),

  togglePhaseScenario: (scenario) => {
    const current = get().selectedPhaseScenarios;
    const exists = current.find(s => s.id === scenario.id);
    if (exists) {
      set({ selectedPhaseScenarios: current.filter(s => s.id !== scenario.id) });
    } else if (current.length < 3) {
      set({ selectedPhaseScenarios: [...current, scenario] });
    }
    // If already 3 selected and trying to add, ignore (user must deselect one first)
  },

  setCostScenario: (scenario) => set({ selectedCostScenario: scenario }),
}));
