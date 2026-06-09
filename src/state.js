export const initialAppState = {
  step: "home",
  request: {
    text: "",
    contentType: "auto",
    industry: "auto",
    mode: "deep",
    tone: "balanced",
    images: []
  },
  result: null,
  history: [],
  chatHistory: [],
  selectedRewriteKey: "platform",
  finalVersion: null,
  simulationMode: false,
  selectedSimulationCase: ""
};

export const workflowState = {
  currentStep: "input",
  steps: ["input", "config", "diagnosing", "report", "rewrite"],
  request: null,
  auditResult: null,
  rewriteResult: null,
  chatHistory: [],
  isDiagnosing: false,
  isRewriting: false,
  error: null
};

export function createWorkflowStore(initialState = workflowState) {
  const state = structuredClone(initialState);

  function assertStep(step) {
    if (!state.steps.includes(step)) {
      throw new Error(`未知流程步骤：${step}`);
    }
  }

  return {
    state,
    goToStep(step) {
      assertStep(step);
      state.currentStep = step;
      state.error = null;
      return state.currentStep;
    },
    goNextStep() {
      const index = state.steps.indexOf(state.currentStep);
      const next = state.steps[Math.min(index + 1, state.steps.length - 1)];
      return this.goToStep(next);
    },
    goPrevStep() {
      const index = state.steps.indexOf(state.currentStep);
      const prev = state.steps[Math.max(index - 1, 0)];
      return this.goToStep(prev);
    },
    setAuditRequest(request) {
      state.request = request;
      state.error = null;
    },
    setAuditResult(result) {
      state.auditResult = result;
      state.isDiagnosing = false;
      state.error = null;
    },
    setRewriteResult(result) {
      state.rewriteResult = result;
      state.isRewriting = false;
      state.error = null;
    },
    setDiagnosing(value) {
      state.isDiagnosing = Boolean(value);
    },
    setRewriting(value) {
      state.isRewriting = Boolean(value);
    },
    setError(error) {
      state.error = error ? String(error.message || error) : null;
      state.isDiagnosing = false;
      state.isRewriting = false;
    }
  };
}
