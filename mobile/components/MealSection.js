import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import FoodLogEntry from "./FoodLogEntry";

const MEAL_ICONS = {
  BREAKFAST: "weather-sunny",
  LUNCH: "food",
  DINNER: "food-variant",
  SNACK: "cookie",
};

const MEAL_LABELS = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
};

export default function MealSection({
  category,
  entries = [],
  expanded,
  onToggle,
  onAddFood,
  onEditEntry,
  onDeleteEntry,
}) {
  const totalCalories = entries.reduce((sum, e) => sum + (e.calories || 0), 0);

  return (
    <View className="bg-surface" style={{ borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <TouchableOpacity
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 14,
          gap: 10,
        }}
      >
        <MaterialCommunityIcons
          name={MEAL_ICONS[category] || "food"}
          size={20}
          color="#9BA3B5"
        />
        <Text
          className="text-primary"
          style={{ flex: 1, fontSize: 15, fontWeight: "600" }}
        >
          {MEAL_LABELS[category] || category}
        </Text>
        <Text className="text-secondary" style={{ fontSize: 13, marginRight: 4 }}>
          {Math.round(totalCalories)} cal
        </Text>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#5C6379"
        />
      </TouchableOpacity>

      {/* Entries */}
      {expanded && (
        <View>
          {entries.map((entry) => (
            <FoodLogEntry
              key={entry.id}
              entry={entry}
              onEdit={() => onEditEntry(entry)}
              onDelete={() => onDeleteEntry(entry.id)}
            />
          ))}

          {/* Add food button */}
          <TouchableOpacity
            onPress={() => onAddFood(category)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 12,
              gap: 8,
              borderTopWidth: entries.length > 0 ? 1 : 0,
              borderTopColor: "#2A2E3D",
            }}
          >
            <MaterialCommunityIcons name="plus" size={18} color="#4DA58E" />
            <Text style={{ fontSize: 13, color: "#4DA58E", fontWeight: "500" }}>
              Add food
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
