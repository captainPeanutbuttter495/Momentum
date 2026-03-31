import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth0 } from "react-native-auth0";
import { createApiClient } from "../services/api";
import { getWorkoutHistory } from "../services/workouts";

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function computeDefaultSelection(workoutsByDate, viewingYear, viewingMonth) {
  const today = getTodayDate();
  const monthPrefix = toMonthKey(viewingYear, viewingMonth);

  // 1. If today is in the viewing month and has a log, select today
  if (today.startsWith(monthPrefix) && workoutsByDate[today]) {
    return today;
  }

  // 2. Most recent workout date in the visible month
  const monthDates = Object.keys(workoutsByDate)
    .filter((d) => d.startsWith(monthPrefix))
    .sort()
    .reverse();

  if (monthDates.length > 0) {
    return monthDates[0];
  }

  // 3. No workouts in month
  return null;
}

export default function useWorkoutCalendar() {
  const { getCredentials } = useAuth0();
  const now = new Date();
  const [viewingYear, setViewingYear] = useState(now.getFullYear());
  const [viewingMonth, setViewingMonth] = useState(now.getMonth());
  const [workoutsByDate, setWorkoutsByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const monthCache = useRef(new Set());

  const getApi = useCallback(async () => {
    const credentials = await getCredentials();
    return createApiClient(credentials.accessToken);
  }, [getCredentials]);

  const fetchMonth = useCallback(
    async (year, month) => {
      const key = toMonthKey(year, month);
      if (monthCache.current.has(key)) return;

      try {
        setIsLoading(true);
        setError(null);
        const api = await getApi();
        const logs = await getWorkoutHistory(api, key);
        monthCache.current.add(key);

        const grouped = {};
        for (const log of logs) {
          if (!grouped[log.date]) {
            grouped[log.date] = [];
          }
          grouped[log.date].push(log);
        }

        setWorkoutsByDate((prev) => ({ ...prev, ...grouped }));
      } catch (err) {
        console.error("Error fetching workout calendar:", err);
        setError("Failed to load workout history");
      } finally {
        setIsLoading(false);
      }
    },
    [getApi],
  );

  // Fetch current month on mount
  useEffect(() => {
    fetchMonth(viewingYear, viewingMonth);
  }, [fetchMonth, viewingYear, viewingMonth]);

  // Compute default selection after data loads
  useEffect(() => {
    if (!isLoading && !error) {
      const defaultDate = computeDefaultSelection(workoutsByDate, viewingYear, viewingMonth);
      setSelectedDate(defaultDate);
    }
  }, [isLoading, error, workoutsByDate, viewingYear, viewingMonth]);

  const navigateMonth = useCallback(
    (direction) => {
      setViewingMonth((prev) => {
        let newMonth = prev + direction;
        let newYear = viewingYear;
        if (newMonth < 0) {
          newMonth = 11;
          newYear = viewingYear - 1;
        } else if (newMonth > 11) {
          newMonth = 0;
          newYear = viewingYear + 1;
        }
        setViewingYear(newYear);
        return newMonth;
      });
    },
    [viewingYear],
  );

  const selectDate = useCallback((dateString) => {
    setSelectedDate(dateString);
  }, []);

  return {
    workoutsByDate,
    isLoading,
    error,
    selectedDate,
    selectDate,
    viewingYear,
    viewingMonth,
    navigateMonth,
    refetch: () => {
      monthCache.current.delete(toMonthKey(viewingYear, viewingMonth));
      fetchMonth(viewingYear, viewingMonth);
    },
  };
}
