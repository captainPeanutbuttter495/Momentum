import { View, Text, TouchableOpacity, Alert } from "react-native";

export default function FoodLogEntry({ entry, onEdit, onDelete }) {
  const handleLongPress = () => {
    Alert.alert(entry.foodName, "What would you like to do?", [
      { text: "Edit", onPress: onEdit },
      { text: "Delete", onPress: onDelete, style: "destructive" },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={onEdit}
      onLongPress={handleLongPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: "#2A2E3D",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          className="text-primary"
          style={{ fontSize: 14 }}
          numberOfLines={1}
        >
          {entry.foodName}
        </Text>
        <Text className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
          {entry.servingQty} × {entry.servingSize}
          {entry.servingUnit}
        </Text>
      </View>
      <Text className="text-secondary" style={{ fontSize: 13 }}>
        {Math.round(entry.calories)} cal
      </Text>
    </TouchableOpacity>
  );
}
