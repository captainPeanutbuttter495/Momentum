import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import useWeeklySummary from "../hooks/useWeeklySummary";

// Strict fixed column widths — all rows share these so numbers align vertically
const COL_DAY = 34;
const COL_STEPS = 54; // icon(11) + gap(4) + number(39, right-aligned)
const COL_CAL = 48;   // icon(11) + gap(4) + number(33, right-aligned)
const COL_GAP = 18;   // gap between cal and workout
const COL_WORKOUT = 24;

function formatDateRange(weekStart, weekEnd) {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} \u2013 ${end.toLocaleDateString("en-US", opts)}`;
}

function formatK(val) {
  if (val === null) return "\u2014";
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

function getWorkoutIcon(workoutName) {
  const name = (workoutName || "").toLowerCase();
  if (name.includes("run") || name.includes("jog") || name.includes("treadmill")) return "run";
  if (name.includes("walk")) return "walk";
  if (name.includes("bike") || name.includes("cycling")) return "bike";
  if (name.includes("swim")) return "swim";
  if (name.includes("yoga") || name.includes("stretch")) return "yoga";
  return "dumbbell";
}

function DeltaBadge({ delta, suffix = "%" }) {
  if (delta === null || delta === undefined) return null;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const color = isUp ? "#4DA58E" : isDown ? "#C4945A" : "#5C6379";
  const icon = isUp ? "arrow-up" : isDown ? "arrow-down" : "minus";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 4 }}>
      <MaterialCommunityIcons name={icon} size={10} color={color} />
      <Text style={{ color, fontSize: 10, marginLeft: 1 }}>
        {Math.abs(delta)}{suffix}
      </Text>
    </View>
  );
}

function DaySummaryRow({ day }) {
  const isToday = day.status === "today";
  const isFuture = day.status === "future";
  const allNull = day.steps === null && day.caloriesOut === null;
  const isEmpty = isFuture || allNull;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 9,
          paddingRight: 4,
        },
        isToday
          ? {
              borderLeftWidth: 2,
              borderLeftColor: "#4DA58E",
              paddingLeft: 10,
              backgroundColor: "#4DA58E10",
              borderRadius: 4,
              marginHorizontal: -2,
            }
          : { paddingLeft: 12 },
        isEmpty ? { opacity: 0.15 } : null,
      ]}
    >
      {/* Day label */}
      <Text
        style={{
          width: COL_DAY,
          fontSize: 11,
          fontWeight: isToday ? "800" : "600",
          color: isToday ? "#4DA58E" : "#9BA3B5",
        }}
      >
        {day.dayOfWeek}
      </Text>

      {isEmpty ? (
        <Text style={{ flex: 1, fontSize: 11, color: "#5C6379" }}>No data</Text>
      ) : (
        <>
          {/* Steps: icon + right-aligned number */}
          <View style={{ width: COL_STEPS, flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons name="shoe-print" size={11} color={isToday ? "#4DA58E" : "#5C6379"} />
            <Text
              style={{
                flex: 1,
                textAlign: "right",
                fontSize: 13,
                fontWeight: isToday ? "700" : "500",
                color: isToday ? "#4DA58E" : "#E8ECF4",
              }}
            >
              {formatK(day.steps)}
            </Text>
          </View>

          {/* Calories: icon + right-aligned number */}
          <View style={{ width: COL_CAL, flexDirection: "row", alignItems: "center", marginLeft: 14 }}>
            <MaterialCommunityIcons name="fire" size={11} color="#C4945A" />
            <Text
              style={{
                flex: 1,
                textAlign: "right",
                fontSize: 13,
                fontWeight: "400",
                color: "#9BA3B5",
              }}
            >
              {formatK(day.caloriesOut)}
            </Text>
          </View>

          {/* Workout: icon only, fixed slot */}
          <View style={{ width: COL_WORKOUT, alignItems: "center", marginLeft: COL_GAP }}>
            {day.workouts.length > 0 ? (
              <MaterialCommunityIcons
                name={getWorkoutIcon(day.workouts[0].name)}
                size={15}
                color="#4DA58E"
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function MidWeekDivider() {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
      <View style={{ height: 1, backgroundColor: "#2A2E3D", opacity: 0.4 }} />
    </View>
  );
}

function StatCard({ icon, iconColor, value, label, delta, deltaSuffix }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#242836",
        borderRadius: 8,
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 4,
      }}
    >
      <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: "#E8ECF4" }}>{value}</Text>
        <DeltaBadge delta={delta} suffix={deltaSuffix} />
      </View>
      <Text style={{ fontSize: 10, color: "#5C6379", marginTop: 3 }}>{label}</Text>
    </View>
  );
}

function PatternChip({ pattern }) {
  const iconMap = {
    streak: { name: "fire", color: "#C4945A" },
    consistent: { name: "check-circle-outline", color: "#4DA58E" },
    weekend_drop: { name: "arrow-down", color: "#C4945A" },
  };
  const iconInfo = iconMap[pattern.type] || { name: "information-outline", color: "#9BA3B5" };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#242836",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 6,
        marginTop: 6,
      }}
    >
      <MaterialCommunityIcons name={iconInfo.name} size={12} color={iconInfo.color} />
      <Text style={{ fontSize: 11, color: "#9BA3B5", marginLeft: 5 }}>{pattern.message}</Text>
    </View>
  );
}

export default function WeeklySummaryCard() {
  const { summary, isLoading, error, aiInsight, isAiLoading, fetchAiInsight } =
    useWeeklySummary();

  if (isLoading) {
    return (
      <View className="bg-surface rounded-xl p-5 mx-6 mt-4 items-center">
        <ActivityIndicator size="small" color="#4DA58E" />
        <Text style={{ fontSize: 11, color: "#9BA3B5", marginTop: 8 }}>Loading weekly summary...</Text>
      </View>
    );
  }

  if (error || !summary) return null;

  const { days, weeklyStats, weekStart, weekEnd, streaks, patterns, comparison } = summary;

  return (
    <View
      className="bg-surface rounded-xl mx-6 mt-4"
      style={{ paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16 }}
    >
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <MaterialCommunityIcons name="calendar-week" size={16} color="#4DA58E" />
          <Text style={{ fontSize: 10, color: "#4DA58E", marginLeft: 8, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>
            Weekly Summary
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: "#5C6379" }}>{formatDateRange(weekStart, weekEnd)}</Text>
      </View>

      {/* Day rows with mid-week divider */}
      {days.map((day, i) => (
        <View key={day.date}>
          {i === 3 && <MidWeekDivider />}
          <DaySummaryRow day={day} />
        </View>
      ))}

      {/* AI Insight — centered between day rows and stat cards (visual midpoint) */}
      {aiInsight && (
        <View
          style={{
            backgroundColor: "#4DA58E20",
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginTop: 12,
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <MaterialCommunityIcons name="auto-fix" size={14} color="#4DA58E" />
            <Text style={{ fontSize: 10, color: "#4DA58E", marginLeft: 6, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>
              Coach Insight
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: "#E8ECF4", lineHeight: 20, fontWeight: "500", textAlign: "center" }}>
            {aiInsight}
          </Text>
        </View>
      )}

      {/* 3 Stat Cards */}
      <View style={{ flexDirection: "row", marginTop: 12, gap: 8 }}>
        <StatCard
          icon="shoe-print"
          iconColor="#9BA3B5"
          value={formatK(weeklyStats.avgSteps)}
          label="avg steps"
          delta={comparison?.avgStepsDelta}
        />
        <StatCard
          icon="dumbbell"
          iconColor="#4DA58E"
          value={String(weeklyStats.workoutCount)}
          label="workouts"
          delta={comparison?.workoutDelta != null ? comparison.workoutDelta : null}
          deltaSuffix=""
        />
        <StatCard
          icon="fire"
          iconColor="#C4945A"
          value={formatK(weeklyStats.avgCalories)}
          label="avg cal"
          delta={comparison?.avgCaloriesDelta}
        />
      </View>

      {/* Pattern Chips + Streaks */}
      {((patterns && patterns.length > 0) || (streaks && streaks.stepStreak >= 2)) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {streaks && streaks.stepStreak >= 2 && (
            <PatternChip pattern={{ type: "streak", message: `${streaks.stepStreak}-day streak over 8k` }} />
          )}
          {patterns && patterns.filter((p) => p.type !== "streak").map((p, i) => (
            <PatternChip key={i} pattern={p} />
          ))}
        </View>
      )}

      {/* CTA: "View Weekly Insight" — hidden once insight is showing */}
      {!aiInsight && (
        <Pressable
          onPress={fetchAiInsight}
          disabled={isAiLoading}
          accessibilityRole="button"
          accessibilityLabel="View weekly insight"
          style={{
            backgroundColor: "#4DA58E",
            borderRadius: 8,
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 11,
          }}
        >
          {isAiLoading ? (
            <ActivityIndicator size="small" color="#E8ECF4" />
          ) : (
            <>
              <MaterialCommunityIcons name="auto-fix" size={16} color="#E8ECF4" />
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#E8ECF4", marginLeft: 8 }}>
                View Weekly Insight
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
