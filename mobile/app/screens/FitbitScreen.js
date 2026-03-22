import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useAuth0 } from "react-native-auth0";
import { useState, useEffect, useCallback } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import GradientBackground from "../../components/GradientBackground";
import CalendarPicker from "../../components/CalendarPicker";
import { createApiClient } from "../../services/api";
import {
  getFitbitAuthUrl,
  getFitbitStatus,
  getFitbitSleep,
  getFitbitActivity,
  getFitbitHeartRate,
  disconnectFitbit,
} from "../../services/fitbit";

const STAGE_COLORS = {
  deep: "#5B6ABF",
  light: "#7BAFD4",
  rem: "#9B7FCA",
  wake: "#C4945A",
};

const STAGE_LABELS = {
  deep: "Deep",
  light: "Light",
  rem: "REM",
  wake: "Awake",
};

const ZONE_COLORS = {
  "Out of Range": "#5C6379",
  "Fat Burn": "#4DA58E",
  Cardio: "#C4945A",
  Peak: "#C4555A",
};

const WORKOUT_ICONS = {
  run: "run",
  running: "run",
  walk: "walk",
  walking: "walk",
  hike: "hiking",
  hiking: "hiking",
  bike: "bike",
  biking: "bike",
  cycling: "bike",
  "outdoor bike": "bike",
  swim: "swim",
  swimming: "swim",
  weights: "weight-lifter",
  "weight lifting": "weight-lifter",
  weightlifting: "weight-lifter",
  yoga: "meditation",
  elliptical: "run-fast",
  treadmill: "run-fast",
  sport: "trophy-outline",
  basketball: "basketball",
  soccer: "soccer",
  tennis: "tennis",
};

function getWorkoutIcon(name) {
  const key = (name || "").toLowerCase();
  return WORKOUT_ICONS[key] || "lightning-bolt";
}

function formatMinutes(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function getTodayDate() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function shiftDate(dateStr, offset) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function FitbitScreen() {
  const { getCredentials } = useAuth0();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sleepData, setSleepData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [heartRateData, setHeartRateData] = useState(null);
  const [prevRestingHR, setPrevRestingHR] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [error, setError] = useState(null);

  const getApi = useCallback(async () => {
    const credentials = await getCredentials();
    return createApiClient(credentials.accessToken);
  }, [getCredentials]);

  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const api = await getApi();
      const status = await getFitbitStatus(api);
      setConnected(status.connected);
    } catch (err) {
      setError("Failed to check Fitbit connection status");
    } finally {
      setLoading(false);
    }
  }, [getApi]);

  const fetchAllData = useCallback(
    async (date) => {
      try {
        setDataLoading(true);
        setError(null);
        const api = await getApi();

        const prevDate = shiftDate(date, -1);
        const [sleep, activity, heartRate, prevHeartRate] = await Promise.allSettled([
          getFitbitSleep(api, date),
          getFitbitActivity(api, date),
          getFitbitHeartRate(api, date),
          getFitbitHeartRate(api, prevDate),
        ]);

        setSleepData(sleep.status === "fulfilled" ? sleep.value : null);
        setActivityData(activity.status === "fulfilled" ? activity.value : null);
        setHeartRateData(heartRate.status === "fulfilled" ? heartRate.value : null);
        setPrevRestingHR(
          prevHeartRate.status === "fulfilled"
            ? prevHeartRate.value?.restingHeartRate || null
            : null,
        );

        if (sleep.status === "rejected" && sleep.reason?.message === "Fitbit not connected") {
          setConnected(false);
        }
      } catch (err) {
        setError("Failed to fetch data");
      } finally {
        setDataLoading(false);
      }
    },
    [getApi],
  );

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (connected) {
      fetchAllData(selectedDate);
    }
  }, [connected, selectedDate, fetchAllData]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const api = await getApi();
      const { url } = await getFitbitAuthUrl(api);

      await WebBrowser.openAuthSessionAsync(url, "momentum://fitbit");

      // After returning from browser, check connection status
      await checkStatus();
    } catch (err) {
      setError("Failed to connect Fitbit");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      const api = await getApi();
      await disconnectFitbit(api);
      setConnected(false);
      setSleepData(null);
      setActivityData(null);
      setHeartRateData(null);
    } catch (err) {
      setError("Failed to disconnect Fitbit");
    }
  };

  const handleDateChange = (offset) => {
    const newDate = shiftDate(selectedDate, offset);
    if (newDate <= getTodayDate()) {
      setSelectedDate(newDate);
    }
  };

  if (loading) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DA58E" />
          <Text className="text-base text-secondary mt-4">
            Checking connection...
          </Text>
        </View>
      </GradientBackground>
    );
  }

  if (!connected) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center px-6">
          <MaterialCommunityIcons
            name="watch"
            size={64}
            color="#5C6379"
          />
          <Text className="text-base text-secondary mt-4 mb-2">
            Fitbit
          </Text>
          <Text className="text-sm text-muted text-center mb-8">
            Connect your Fitbit to view sleep, activity, and heart rate data
          </Text>

          {error && (
            <Text className="text-sm text-error mb-4 text-center">{error}</Text>
          )}

          <Pressable
            onPress={handleConnect}
            disabled={connecting}
            className="w-full bg-accent rounded-xl py-4 items-center"
            accessibilityRole="button"
            accessibilityLabel="Connect Fitbit"
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              opacity: connecting ? 0.7 : 1,
            }}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#E8ECF4" />
            ) : (
              <MaterialCommunityIcons name="link" size={20} color="#E8ECF4" />
            )}
            <Text className="text-primary text-lg font-semibold">
              {connecting ? "Connecting..." : "Connect Fitbit"}
            </Text>
          </Pressable>
        </View>
      </GradientBackground>
    );
  }

  // Connected state
  return (
    <GradientBackground>
      {/* Header */}
      <View className="px-4 pt-14 pb-3 border-b border-border">
        <Text className="text-lg font-semibold text-primary">Fitbit</Text>
        <Text className="text-xs text-muted">
          Sleep, Activity & Heart Rate
        </Text>
      </View>

      {/* Date selector */}
      <View className="flex-row items-center justify-between px-6 py-3">
        <Pressable
          onPress={() => handleDateChange(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          className="p-2"
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={24}
            color="#9BA3B5"
          />
        </Pressable>
        <Pressable
          onPress={() => setCalendarVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Open calendar"
          className="flex-row items-center"
          style={{ gap: 6 }}
        >
          <Text className="text-base text-primary font-medium">
            {formatDisplayDate(selectedDate)}
          </Text>
          <MaterialCommunityIcons name="calendar" size={16} color="#9BA3B5" />
        </Pressable>
        <Pressable
          onPress={() => handleDateChange(1)}
          disabled={selectedDate >= getTodayDate()}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          className="p-2"
          style={{ opacity: selectedDate >= getTodayDate() ? 0.3 : 1 }}
        >
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#9BA3B5"
          />
        </Pressable>
      </View>

      {dataLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DA58E" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-sm text-error text-center mb-4">{error}</Text>
          <Pressable
            onPress={() => fetchAllData(selectedDate)}
            className="bg-surface rounded-lg px-6 py-3"
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text className="text-primary text-sm">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>

          {/* ── Activity Section ── */}
          <View className="bg-surface rounded-xl p-4 mt-2 mb-4">
            <View className="flex-row items-center mb-3">
              <MaterialCommunityIcons name="walk" size={18} color="#4DA58E" />
              <Text className="text-sm text-secondary ml-2">Activity</Text>
            </View>
            {activityData ? (
              <>
                <View className="flex-row justify-around mb-3">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary">
                      {activityData.steps.toLocaleString()}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Steps</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary">
                      {activityData.distance.toFixed(1)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Miles</Text>
                  </View>
                </View>
                <View className="flex-row justify-around border-t border-border pt-3">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary">
                      {activityData.caloriesOut?.toLocaleString() || "0"}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Calories</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary">
                      {(activityData.activeMinutes?.fairlyActive || 0) + (activityData.activeMinutes?.veryActive || 0)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Active Min</Text>
                  </View>
                </View>
              </>
            ) : (
              <Text className="text-sm text-muted text-center">No activity data</Text>
            )}
          </View>

          {/* ── Workouts Section ── */}
          <View className="bg-surface rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <MaterialCommunityIcons name="dumbbell" size={18} color="#4DA58E" />
              <Text className="text-sm text-secondary ml-2">Workouts</Text>
              <View className="ml-auto bg-surface-elevated rounded-full px-2 py-0.5">
                <Text className="text-xs text-muted">
                  {activityData?.workouts?.length || 0}
                </Text>
              </View>
            </View>
            {activityData?.workouts?.length > 0 ? (
              activityData.workouts.map((workout, index) => (
                <View
                  key={index}
                  className="bg-surface-elevated rounded-lg p-3 mb-2"
                >
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name={getWorkoutIcon(workout.name)}
                      size={18}
                      color="#4DA58E"
                    />
                    <Text className="text-sm text-primary font-medium ml-2">
                      {workout.name}
                    </Text>
                  </View>
                  <View className="flex-row items-center mt-1 ml-7">
                    <Text className="text-xs text-muted">
                      {formatDuration(workout.duration)}
                    </Text>
                    <Text className="text-xs text-muted mx-2">·</Text>
                    <Text className="text-xs text-muted">
                      {workout.calories} cal
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-sm text-muted text-center">
                No workouts for today
              </Text>
            )}
          </View>

          {/* ── Heart Rate Section ── */}
          <View className="bg-surface rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <MaterialCommunityIcons name="heart-pulse" size={18} color="#C4555A" />
              <Text className="text-sm text-secondary ml-2">Heart Rate</Text>
            </View>
            {heartRateData ? (
              <>
                {heartRateData.restingHeartRate && (
                  <View className="items-center mb-4">
                    <Text className="text-3xl font-bold text-primary">
                      {heartRateData.restingHeartRate}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Resting BPM</Text>
                    {prevRestingHR != null && (
                      (() => {
                        const delta = heartRateData.restingHeartRate - prevRestingHR;
                        if (delta === 0) return (
                          <View className="flex-row items-center mt-2">
                            <MaterialCommunityIcons name="minus" size={14} color="#9BA3B5" />
                            <Text className="text-xs text-secondary ml-1">No change from yesterday</Text>
                          </View>
                        );
                        const isUp = delta > 0;
                        return (
                          <View className="flex-row items-center mt-2">
                            <MaterialCommunityIcons
                              name={isUp ? "arrow-up" : "arrow-down"}
                              size={14}
                              color={isUp ? "#C4555A" : "#4DA58E"}
                            />
                            <Text
                              className={`text-xs ml-1 ${isUp ? "text-error" : "text-accent"}`}
                            >
                              {Math.abs(delta)} BPM from yesterday
                            </Text>
                          </View>
                        );
                      })()
                    )}
                  </View>
                )}
                {heartRateData.zones
                  .filter((zone) => zone.name === "Cardio" || zone.name === "Peak")
                  .map((zone) => {
                  const filteredZones = heartRateData.zones.filter((z) => z.name === "Cardio" || z.name === "Peak");
                  const maxMinutes = Math.max(...filteredZones.map((z) => z.minutes), 1);
                  const pct = Math.round((zone.minutes / maxMinutes) * 100);
                  return (
                    <View key={zone.name} className="flex-row items-center mb-3">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: ZONE_COLORS[zone.name] || "#5C6379",
                          marginRight: 10,
                        }}
                      />
                      <Text className="text-xs text-primary" style={{ width: 80 }}>
                        {zone.name}
                      </Text>
                      <View className="flex-1 mx-2 h-2 bg-background rounded-full overflow-hidden">
                        <View
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            backgroundColor: ZONE_COLORS[zone.name] || "#5C6379",
                            borderRadius: 9999,
                          }}
                        />
                      </View>
                      <Text className="text-xs text-muted" style={{ width: 50, textAlign: "right" }}>
                        {formatMinutes(zone.minutes)}
                      </Text>
                    </View>
                  );
                })}
                {(() => {
                  const cardio = heartRateData.zones.find((z) => z.name === "Cardio");
                  const peak = heartRateData.zones.find((z) => z.name === "Peak");
                  return cardio && peak ? (
                    <Text className="text-xs text-muted text-center mt-1">
                      {cardio.min}–{peak.max} BPM range
                    </Text>
                  ) : null;
                })()}
              </>
            ) : (
              <Text className="text-sm text-muted text-center">No heart rate data</Text>
            )}
          </View>

          {/* ── Sleep Section ── */}
          {sleepData && sleepData.sleepLog.length > 0 ? (
            <>
              <View className="bg-surface rounded-xl p-4 mb-4">
                <View className="flex-row items-center mb-3">
                  <MaterialCommunityIcons name="sleep" size={18} color="#5B6ABF" />
                  <Text className="text-sm text-secondary ml-2">Sleep</Text>
                </View>

                {/* Sleep Score */}
                {sleepData.sleepLog[0].efficiency != null && (
                  <View className="items-center mb-4">
                    <Text className="text-3xl font-bold text-primary">
                      {sleepData.sleepLog[0].efficiency}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Sleep Score</Text>
                  </View>
                )}

                <View className="flex-row justify-around mb-4">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary">
                      {formatMinutes(sleepData.summary.totalMinutesAsleep)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">Asleep</Text>
                  </View>
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-primary">
                      {formatMinutes(sleepData.summary.totalTimeInBed)}
                    </Text>
                    <Text className="text-xs text-muted mt-1">In Bed</Text>
                  </View>
                </View>

                {/* Bedtime / Wake Time */}
                <View className="border-t border-border pt-3">
                  <View className="flex-row justify-around">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="weather-night" size={16} color="#5B6ABF" />
                      <View className="ml-2">
                        <Text className="text-sm font-medium text-primary">
                          {new Date(sleepData.sleepLog[0].startTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>
                        <Text className="text-xs text-muted">Bedtime</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="weather-sunny" size={16} color="#C4945A" />
                      <View className="ml-2">
                        <Text className="text-sm font-medium text-primary">
                          {new Date(sleepData.sleepLog[0].endTime).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </Text>
                        <Text className="text-xs text-muted">Wake Time</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              {/* Sleep stages */}
              <View className="bg-surface rounded-xl p-4 mb-4">
                <Text className="text-sm text-secondary mb-3">Sleep Stages</Text>
                {Object.entries(sleepData.summary.stages).map(([stage, minutes]) => {
                  const total = sleepData.summary.totalTimeInBed || 1;
                  const pct = Math.round((minutes / total) * 100);
                  return (
                    <View key={stage} className="flex-row items-center mb-3">
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: STAGE_COLORS[stage] || "#5C6379",
                          marginRight: 10,
                        }}
                      />
                      <Text className="text-sm text-primary w-14">
                        {STAGE_LABELS[stage] || stage}
                      </Text>
                      <View className="flex-1 mx-3 h-2 bg-background rounded-full overflow-hidden">
                        <View
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            backgroundColor: STAGE_COLORS[stage] || "#5C6379",
                            borderRadius: 9999,
                          }}
                        />
                      </View>
                      <Text className="text-xs text-muted w-16 text-right">
                        {formatMinutes(minutes)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Hypnogram */}
              {sleepData.sleepLog[0]?.levels?.data && (
                <View className="bg-surface rounded-xl p-4 mb-4">
                  <Text className="text-sm text-secondary mb-3">Sleep Timeline</Text>
                  <View className="flex-row">
                    {/* Y-axis labels */}
                    <View className="justify-between mr-2" style={{ height: 120 }}>
                      <Text className="text-xs text-muted" style={{ lineHeight: 12 }}>Awake</Text>
                      <Text className="text-xs text-muted" style={{ lineHeight: 12 }}>REM</Text>
                      <Text className="text-xs text-muted" style={{ lineHeight: 12 }}>Light</Text>
                      <Text className="text-xs text-muted" style={{ lineHeight: 12 }}>Deep</Text>
                    </View>
                    {/* Hypnogram chart */}
                    <View className="flex-1" style={{ height: 120 }}>
                      {/* Grid lines */}
                      {[0, 1, 2, 3].map((level) => (
                        <View
                          key={level}
                          style={{
                            position: "absolute",
                            top: (level / 3) * 100 + "%",
                            left: 0,
                            right: 0,
                            height: 1,
                            backgroundColor: "#2A2E3D",
                          }}
                        />
                      ))}
                      {/* Stepped segments */}
                      {(() => {
                        const entries = sleepData.sleepLog[0].levels.data;
                        const totalSeconds = entries.reduce((sum, e) => sum + e.seconds, 0);
                        const stageToRow = { wake: 0, rem: 1, light: 2, deep: 3 };
                        const rowHeight = 120 / 3;
                        let leftPct = 0;

                        return entries.map((entry, i) => {
                          const widthPct = (entry.seconds / totalSeconds) * 100;
                          const row = stageToRow[entry.level] ?? 1;
                          const topPx = row * rowHeight - 2;
                          const currentLeft = leftPct;
                          leftPct += widthPct;

                          const nextRow = i < entries.length - 1
                            ? (stageToRow[entries[i + 1].level] ?? 1)
                            : row;
                          const vertTop = Math.min(row, nextRow) * rowHeight - 2;
                          const vertHeight = Math.abs(nextRow - row) * rowHeight + 4;

                          return (
                            <View key={i}>
                              {/* Horizontal step */}
                              <View
                                style={{
                                  position: "absolute",
                                  left: `${currentLeft}%`,
                                  width: `${widthPct}%`,
                                  top: topPx,
                                  height: 4,
                                  backgroundColor: STAGE_COLORS[entry.level] || "#5C6379",
                                  borderRadius: 2,
                                }}
                              />
                              {/* Vertical connector to next stage */}
                              {i < entries.length - 1 && row !== nextRow && (
                                <View
                                  style={{
                                    position: "absolute",
                                    left: `${leftPct}%`,
                                    top: vertTop,
                                    width: 2,
                                    height: vertHeight,
                                    backgroundColor: STAGE_COLORS[entry.level] || "#5C6379",
                                    marginLeft: -1,
                                  }}
                                />
                              )}
                            </View>
                          );
                        });
                      })()}
                    </View>
                  </View>
                  {/* Time labels */}
                  <View className="flex-row justify-between mt-2" style={{ marginLeft: 42 }}>
                    <Text className="text-xs text-muted">
                      {new Date(sleepData.sleepLog[0].startTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Text className="text-xs text-muted">
                      {new Date(sleepData.sleepLog[0].endTime).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  {/* Legend */}
                  <View className="flex-row justify-center mt-3" style={{ gap: 12 }}>
                    {Object.entries(STAGE_COLORS).map(([stage, color]) => (
                      <View key={stage} className="flex-row items-center">
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 4 }} />
                        <Text className="text-xs text-muted">{STAGE_LABELS[stage]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            <View className="bg-surface rounded-xl p-4 mb-4 items-center">
              <MaterialCommunityIcons name="sleep" size={32} color="#5C6379" />
              <Text className="text-sm text-muted mt-2">No sleep data for this date</Text>
            </View>
          )}

          {/* Disconnect button */}
          <Pressable
            onPress={handleDisconnect}
            className="items-center py-4 mb-8"
            accessibilityRole="button"
            accessibilityLabel="Disconnect Fitbit"
          >
            <Text className="text-sm text-error">Disconnect Fitbit</Text>
          </Pressable>
        </ScrollView>
      )}

      {calendarVisible && (
        <CalendarPicker
          visible={calendarVisible}
          selectedDate={selectedDate}
          onSelectDate={(date) => setSelectedDate(date)}
          onClose={() => setCalendarVisible(false)}
        />
      )}
    </GradientBackground>
  );
}
