import { View, Text, Pressable } from "react-native";
import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import WorkoutLogModal from "./WorkoutLogModal";

export default function WorkoutCard({
  todayLogs,
  templates,
  onLogWorkout,
  onSaveTemplate,
  isSaving,
}) {
  const [modalVisible, setModalVisible] = useState(false);

  const totalExercises = todayLogs.reduce((sum, log) => sum + (log.exercises?.length || 0), 0);

  return (
    <>
      <View className="bg-surface rounded-xl p-5 mx-6 mt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="dumbbell" size={16} color="#4DA58E" />
            <Text className="text-xs text-accent ml-2 font-semibold uppercase tracking-wider">
              Workout
            </Text>
            {totalExercises > 0 && (
              <Text className="text-xs text-muted ml-2">
                {"\u00B7"} {totalExercises} exercise{totalExercises !== 1 ? "s" : ""}
              </Text>
            )}
          </View>
        </View>

        {todayLogs.length === 0 ? (
          /* Empty state */
          <View className="items-center py-2">
            <Text className="text-sm text-secondary mb-3">No workout logged today</Text>
            <Pressable
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Log workout"
              className="bg-accent rounded-lg px-5 py-2.5 flex-row items-center"
            >
              <MaterialCommunityIcons name="plus" size={16} color="#E8ECF4" />
              <Text className="text-sm font-semibold text-primary ml-1.5">Log Workout</Text>
            </Pressable>
          </View>
        ) : (
          /* Logged state */
          <View>
            {todayLogs.map((log) => (
              <View key={log.id} className="mb-2">
                {log.templateId && (
                  <Text className="text-sm font-semibold text-primary mb-1.5">
                    {templates.find((t) => t.id === log.templateId)?.name || "Custom Workout"}
                  </Text>
                )}
                {(log.exercises || []).slice(0, 4).map((ex, i) => (
                  <View key={i} className="flex-row items-center justify-between py-0.5">
                    <Text className="text-sm text-secondary flex-1" numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text className="text-sm text-muted ml-2">
                      {ex.weightLbs}lbs {ex.sets}{"\u00D7"}{ex.reps}
                    </Text>
                  </View>
                ))}
                {(log.exercises || []).length > 4 && (
                  <Text className="text-xs text-muted mt-1">
                    +{log.exercises.length - 4} more
                  </Text>
                )}
              </View>
            ))}
            <Pressable
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Log another workout"
              className="flex-row items-center justify-center py-2 mt-1"
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#4DA58E" />
              <Text className="text-sm text-accent ml-1.5">Log Another</Text>
            </Pressable>
          </View>
        )}
      </View>

      <WorkoutLogModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        templates={templates}
        onLogWorkout={onLogWorkout}
        onSaveTemplate={onSaveTemplate}
        isSaving={isSaving}
      />
    </>
  );
}
