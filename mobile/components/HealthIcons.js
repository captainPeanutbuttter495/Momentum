import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const ITEMS = [
  { icon: "silverware-fork-knife", label: "Nutrition" },
  { icon: "dumbbell", label: "Workouts" },
  { icon: "heart-pulse", label: "Health" },
];

export default function HealthIcons() {
  return (
    <View className="flex-row items-center justify-center mb-64" style={{ gap: 32 }}>
      {ITEMS.map((item) => (
        <View key={item.label} className="items-center">
          <MaterialCommunityIcons name={item.icon} size={24} color="#9BA3B5" />
          <Text className="text-xs text-muted mt-1">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
