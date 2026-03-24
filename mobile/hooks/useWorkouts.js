import { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "react-native-auth0";
import { createApiClient } from "../services/api";
import {
  getTemplates as fetchTemplatesApi,
  getWorkoutLogs,
  logWorkout as logWorkoutApi,
  deleteWorkoutLog,
  createTemplate as createTemplateApi,
  updateTemplate as updateTemplateApi,
  deleteTemplate as deleteTemplateApi,
} from "../services/workouts";

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function useWorkouts() {
  const { getCredentials } = useAuth0();
  const [templates, setTemplates] = useState([]);
  const [todayLogs, setTodayLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const getApi = useCallback(async () => {
    const credentials = await getCredentials();
    return createApiClient(credentials.accessToken);
  }, [getCredentials]);

  const fetchTemplates = useCallback(async () => {
    try {
      const api = await getApi();
      const result = await fetchTemplatesApi(api);
      setTemplates(result);
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
  }, [getApi]);

  const fetchTodayLogs = useCallback(async () => {
    try {
      const api = await getApi();
      const today = getTodayDate();
      const result = await getWorkoutLogs(api, today);
      setTodayLogs(result);
    } catch (err) {
      console.error("Error fetching today's logs:", err);
    }
  }, [getApi]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchTemplates(), fetchTodayLogs()]);
    } catch (err) {
      setError("Failed to load workout data");
    } finally {
      setIsLoading(false);
    }
  }, [fetchTemplates, fetchTodayLogs]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const logWorkout = useCallback(
    async (workoutData) => {
      setIsSaving(true);
      try {
        const api = await getApi();
        const result = await logWorkoutApi(api, workoutData);
        setTodayLogs((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [getApi],
  );

  const deleteLog = useCallback(
    async (id) => {
      try {
        const api = await getApi();
        await deleteWorkoutLog(api, id);
        setTodayLogs((prev) => prev.filter((log) => log.id !== id));
      } catch (err) {
        throw err;
      }
    },
    [getApi],
  );

  const saveTemplate = useCallback(
    async (templateData) => {
      setIsSaving(true);
      try {
        const api = await getApi();
        const result = await createTemplateApi(api, templateData);
        setTemplates((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [getApi],
  );

  const editTemplate = useCallback(
    async (id, templateData) => {
      setIsSaving(true);
      try {
        const api = await getApi();
        const result = await updateTemplateApi(api, id, templateData);
        setTemplates((prev) => prev.map((t) => (t.id === id ? result : t)));
        return result;
      } catch (err) {
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [getApi],
  );

  const removeTemplate = useCallback(
    async (id) => {
      try {
        const api = await getApi();
        await deleteTemplateApi(api, id);
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        throw err;
      }
    },
    [getApi],
  );

  return {
    templates,
    todayLogs,
    isLoading,
    isSaving,
    error,
    fetchTemplates,
    fetchTodayLogs,
    logWorkout,
    deleteLog,
    saveTemplate,
    editTemplate,
    removeTemplate,
    refetch: loadAll,
  };
}
