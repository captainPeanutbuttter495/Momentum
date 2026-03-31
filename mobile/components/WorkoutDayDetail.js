import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

function formatDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatExercise(ex) {
  const parts = [ex.name];
  if (ex.weightLbs && ex.weightLbs > 0) {
    parts.push(`${ex.weightLbs} lbs`);
  }
  if (ex.sets && ex.reps) {
    parts.push(`${ex.sets}\u00D7${ex.reps}`);
  }
  return parts.join(" \u2014 ");
}

export default function WorkoutDayDetail({ date, logs }) {
  if (!logs || logs.length === 0) {
    return (
      <View className="bg-surface rounded-xl p-5 mx-4 mt-4 items-center">
        <MaterialCommunityIcons name="calendar-blank" size={28} color="#5C6379" />
        <Text className="text-sm text-secondary mt-2">No workout logged</Text>
      </View>
    );
  }

  return (
    <View className="mx-4 mt-4" testID="workout-day-detail">
      <Text className="text-secondary text-sm mb-3">{formatDate(date)}</Text>

      {logs.map((log) => (
        <View key={log.id} className="bg-surface rounded-xl p-4 mb-3">
          <Text className="text-primary text-base font-semibold mb-1">
            {log.fitbitWorkoutName || "Workout"}
          </Text>

          {log.exercises && log.exercises.length > 0 ? (
            <View style={{ gap: 6 }}>
              {log.exercises.map((ex, i) => (
                <View key={i} className="flex-row items-center">
                  <MaterialCommunityIcons name="dumbbell" size={14} color="#5C6379" />
                  <Text className="text-secondary text-sm ml-2">
                    {formatExercise(ex)}
                  </Text>
                </View>
              ))}
            </View>
          ) : log.description ? (
            <Text className="text-muted text-sm">{log.description}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
