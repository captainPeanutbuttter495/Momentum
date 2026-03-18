import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function CalorieWarning({ calorieTarget, gender }) {
  const floor = gender === "FEMALE" ? 1200 : 1500;
  if (calorieTarget >= floor) return null;

  return (
    <View
      className="bg-surface border border-warning/30 rounded-xl p-3 mt-2"
      style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
      testID="calorie-warning"
    >
      <MaterialCommunityIcons name="alert-outline" size={20} color="#C4945A" />
      <Text className="text-warning text-sm" style={{ flex: 1 }}>
        This calorie target is below recommended minimums. Consult a healthcare provider.
      </Text>
    </View>
  );
}
