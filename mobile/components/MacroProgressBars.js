import { View, Text } from "react-native";

const MACROS = [
  { key: "proteinG", label: "Protein", color: "#4DA58E" },
  { key: "carbsG", label: "Carbs", color: "#C4945A" },
  { key: "fatG", label: "Fat", color: "#9BA3B5" },
];

export default function MacroProgressBars({
  consumed = { proteinG: 0, carbsG: 0, fatG: 0 },
  targets = { proteinG: 0, carbsG: 0, fatG: 0 },
}) {
  return (
    <View style={{ gap: 12 }}>
      {MACROS.map(({ key, label, color }) => {
        const current = Math.round(consumed[key] || 0);
        const goal = Math.round(targets[key] || 0);
        const pct = goal > 0 ? Math.min(current / goal, 1) : 0;

        return (
          <View key={key}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text className="text-secondary text-xs">{label}</Text>
              <Text className="text-secondary text-xs">
                {current}g / {goal}g
              </Text>
            </View>
            <View
              style={{ height: 8, borderRadius: 4, overflow: "hidden" }}
              className="bg-border"
            >
              <View
                style={{
                  width: `${pct * 100}%`,
                  height: "100%",
                  borderRadius: 4,
                  backgroundColor: color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
