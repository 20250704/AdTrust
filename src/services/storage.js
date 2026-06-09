const HISTORY_KEY = "adtrust-history";

export const storage = {
  loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (error) {
      localStorage.removeItem(HISTORY_KEY);
      return [];
    }
  },
  saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  },
  clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }
};
