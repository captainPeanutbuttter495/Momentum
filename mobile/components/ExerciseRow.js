import { View, Text, TextInput, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ExerciseRow({ exercise, index, onChange, onDelete, editable = true }) {
  const handleFieldChange = (field, value) => {
    onChange(index, { ...exercise, [field]: value });
  };

  return (
    <View className="bg-surface-elevated rounded-xl p-3 mb-2">
      {/* Exercise name row */}
      <View className="flex-row items-center mb-2">
        {editable ? (
          <TextInput
            value={exercise.name}
            onChangeText={(val) => handleFieldChange("name", val)}
            placeholder="Exercise name"
            placeholderTextColor="#5C6379"
            testID={`exercise-name-${index}`}
            className="text-primary text-sm font-semibold flex-1"
          />
        ) : (
          <Text className="text-primary text-sm font-semibold flex-1">{exercise.name}</Text>
        )}
        {onDelete && (
          <Pressable
            onPress={() => onDelete(index)}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${exercise.name || "exercise"}`}
            className="p-1 ml-2"
          >
            <MaterialCommunityIcons name="close-circle-outline" size={18} color="#C4555A" />
          </Pressable>
        )}
      </View>

      {/* Weight / Sets / Reps row */}
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <View className="flex-1">
          <Text className="text-muted text-xs mb-1">Weight</Text>
          <View className="bg-surface border border-border rounded-lg px-3 py-2 flex-row items-center">
            <TextInput
              value={String(exercise.weightLbs ?? "")}
              onChangeText={(val) => handleFieldChange("weightLbs", val)}
              placeholder="0"
              placeholderTextColor="#5C6379"
              keyboardType="numeric"
              testID={`exercise-weight-${index}`}
              className="text-primary text-sm flex-1"
            />
            <Text className="text-muted text-xs ml-1">lbs</Text>
          </View>
        </View>

        <View className="flex-1">
          <Text className="text-muted text-xs mb-1">Sets</Text>
          <View className="bg-surface border border-border rounded-lg px-3 py-2">
            <TextInput
              value={String(exercise.sets ?? "")}
              onChangeText={(val) => handleFieldChange("sets", val)}
              placeholder="0"
              placeholderTextColor="#5C6379"
              keyboardType="numeric"
              testID={`exercise-sets-${index}`}
              className="text-primary text-sm"
            />
          </View>
        </View>

        <View className="flex-1">
          <Text className="text-muted text-xs mb-1">Reps</Text>
          <View className="bg-surface border border-border rounded-lg px-3 py-2">
            <TextInput
              value={String(exercise.reps ?? "")}
              onChangeText={(val) => handleFieldChange("reps", val)}
              placeholder="0"
              placeholderTextColor="#5C6379"
              keyboardType="numeric"
              testID={`exercise-reps-${index}`}
              className="text-primary text-sm"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
