import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "react-native-auth0";
import { createApiClient } from "../services/api";
import {
  getDailySummary,
  getFoodLog,
  logFood as logFoodApi,
  updateFoodLog,
  deleteFoodLog,
  searchFoods as searchFoodsApi,
  createCustomFood as createCustomFoodApi,
  scanNutritionLabel as scanNutritionLabelApi,
} from "../services/nutrition";

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function useNutrition() {
  const { getCredentials } = useAuth0();
  const [summary, setSummary] = useState(null);
  const [foodLog, setFoodLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const getApi = useCallback(async () => {
    const credentials = await getCredentials();
    return createApiClient(credentials.accessToken);
  }, [getCredentials]);

  const fetchSummary = useCallback(async () => {
    try {
      const api = await getApi();
      const today = getTodayDate();
      const result = await getDailySummary(api, today);
      setSummary(result);
      setFoodLog(result.logs || []);
    } catch (err) {
      console.error("Error fetching nutrition summary:", err);
    }
  }, [getApi]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchSummary();
    } catch (err) {
      setError("Failed to load nutrition data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchSummary]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const addFoodEntry = useCallback(
    async (entry) => {
      setIsSaving(true);
      try {
        const api = await getApi();
        const result = await logFoodApi(api, entry);
        setFoodLog((prev) => [...prev, result]);
        await fetchSummary();
        return result;
      } catch (err) {
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [getApi, fetchSummary],
  );

  const updateEntry = useCallback(
    async (id, data) => {
      setIsSaving(true);
      try {
        const api = await getApi();
        const result = await updateFoodLog(api, id, data);
        setFoodLog((prev) => prev.map((e) => (e.id === id ? result : e)));
        await fetchSummary();
        return result;
      } catch (err) {
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [getApi, fetchSummary],
  );

  const removeEntry = useCallback(
    async (id) => {
      try {
        const api = await getApi();
        await deleteFoodLog(api, id);
        setFoodLog((prev) => prev.filter((e) => e.id !== id));
        await fetchSummary();
      } catch (err) {
        throw err;
      }
    },
    [getApi, fetchSummary],
  );

  const searchFoods = useCallback(
    async (query, customOnly = false) => {
      const api = await getApi();
      return searchFoodsApi(api, query, customOnly);
    },
    [getApi],
  );

  const createCustomFood = useCallback(
    async (data) => {
      setIsSaving(true);
      try {
        const api = await getApi();
        return await createCustomFoodApi(api, data);
      } finally {
        setIsSaving(false);
      }
    },
    [getApi],
  );

  const scanLabel = useCallback(
    async (photoBase64, mediaType) => {
      const api = await getApi();
      return scanNutritionLabelApi(api, photoBase64, mediaType);
    },
    [getApi],
  );

  return {
    summary,
    foodLog,
    isLoading,
    isSaving,
    error,
    addFoodEntry,
    updateEntry,
    removeEntry,
    searchFoods,
    createCustomFood,
    scanLabel,
    refetch: loadAll,
  };
}
