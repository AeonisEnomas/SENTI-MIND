import { useState, useCallback } from "react";
import { analyzeText } from "../services/analysisService";
import { getErrorMessage } from "../lib/errors";

export function useAnalysis() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (text) => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeText(text);
      setResult(data);
      return data;           // ← callers need this to log mood & save entry
    } catch (err) {
      setError(getErrorMessage(err, "We couldn't analyze your entry right now. Please try again."));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, loading, error, analyze, reset };
}
