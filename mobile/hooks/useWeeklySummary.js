import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "react-native-auth0";
import { createApiClient } from "../services/api";
import { getFitbitStatus, getWeeklySummary, getWeeklyInsight } from "../services/fitbit";

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function useWeeklySummary() {
  const { getCredentials } = useAuth0();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiInsight, setAiInsight] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const getApi = useCallback(async () => {
    const credentials = await getCredentials();
    return createApiClient(credentials.accessToken);
  }, [getCredentials]);

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const api = await getApi();

      const status = await getFitbitStatus(api);
      if (!status.connected) {
        setSummary(null);
        return;
      }

      const today = getTodayDate();
      const result = await getWeeklySummary(api, today);
      setSummary(result);
    } catch (err) {
      setError("Failed to load weekly summary");
    } finally {
      setIsLoading(false);
    }
  }, [getApi]);

  const fetchAiInsight = useCallback(async () => {
    try {
      setIsAiLoading(true);
      const api = await getApi();
      const today = getTodayDate();
      const result = await getWeeklyInsight(api, today);
      setAiInsight(result.weeklyInsight);
    } catch (err) {
      setAiInsight("Unable to generate weekly insight right now.");
    } finally {
      setIsAiLoading(false);
    }
  }, [getApi]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    isLoading,
    error,
    aiInsight,
    isAiLoading,
    refetch: fetchSummary,
    fetchAiInsight,
  };
}
