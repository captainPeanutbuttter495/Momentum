import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "react-native-auth0";
import { createApiClient } from "../services/api";
import { getFitbitStatus } from "../services/fitbit";
import { getCoachInsight } from "../services/coach";

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export default function useCoachInsight() {
  const { getCredentials } = useAuth0();
  const [insights, setInsights] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecapLoading, setIsRecapLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  const getApi = useCallback(async () => {
    const credentials = await getCredentials();
    return createApiClient(credentials.accessToken);
  }, [getCredentials]);

  const fetchInsight = useCallback(
    async (context) => {
      try {
        if (context === "morning") {
          setIsLoading(true);
        } else {
          setIsRecapLoading(true);
        }
        setError(null);

        const api = await getApi();

        // Check Fitbit connection
        const status = await getFitbitStatus(api);
        setIsConnected(status.connected);

        if (!status.connected) {
          setInsights(null);
          return;
        }

        const today = getTodayDate();
        const result = await getCoachInsight(api, today, context);
        setInsights(result);
      } catch (err) {
        setError("Failed to load coaching insight");
      } finally {
        setIsLoading(false);
        setIsRecapLoading(false);
      }
    },
    [getApi],
  );

  useEffect(() => {
    fetchInsight("morning");
  }, [fetchInsight]);

  const refetch = useCallback(() => fetchInsight("morning"), [fetchInsight]);
  const fetchRecap = useCallback(() => fetchInsight("recap"), [fetchInsight]);

  return { insights, isLoading, isRecapLoading, error, isConnected, refetch, fetchRecap };
}
