import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function SelectionCard({ icon, title, description, selected, onPress, testID }) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      className={`rounded-xl p-4 border ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-surface"
      }`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      {icon && (
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={selected ? "#4DA58E" : "#9BA3B5"}
        />
      )}
      <View style={{ flex: 1 }}>
        <Text className={`text-base font-semibold ${selected ? "text-accent" : "text-primary"}`}>
          {title}
        </Text>
        {description && (
          <Text className="text-secondary text-sm mt-1">{description}</Text>
        )}
      </View>
      {selected && (
        <MaterialCommunityIcons name="check-circle" size={22} color="#4DA58E" />
      )}
    </Pressable>
  );
}
