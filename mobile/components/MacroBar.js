import { View, Text } from "react-native";

const COLORS = {
  protein: "#4DA58E",
  carbs: "#C4945A",
  fat: "#9BA3B5",
};

export default function MacroBar({ proteinPct, carbPct, fatPct, proteinGrams, carbGrams, fatGrams }) {

  return (
    <View>
      <View
        style={{ flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden" }}
        className="bg-border"
      >
        <View style={{ flex: proteinPct, backgroundColor: COLORS.protein }} />
        <View style={{ flex: carbPct, backgroundColor: COLORS.carbs }} />
        <View style={{ flex: fatPct, backgroundColor: COLORS.fat }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <MacroLabel color={COLORS.protein} label="Protein" pct={proteinPct} grams={proteinGrams} />
        <MacroLabel color={COLORS.carbs} label="Carbs" pct={carbPct} grams={carbGrams} />
        <MacroLabel color={COLORS.fat} label="Fat" pct={fatPct} grams={fatGrams} />
      </View>
    </View>
  );
}

function MacroLabel({ color, label, pct, grams }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text className="text-secondary text-xs">{label}</Text>
      </View>
      <Text className="text-primary text-sm font-semibold">{pct}%</Text>
      {grams !== null && (
        <Text className="text-muted text-xs">{grams}g</Text>
      )}
    </View>
  );
}
