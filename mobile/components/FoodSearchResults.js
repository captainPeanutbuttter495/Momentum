import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";

export default function FoodSearchResults({ results, onSelect, isLoading }) {
  if (isLoading) {
    return (
      <View style={{ paddingVertical: 20, alignItems: "center" }}>
        <ActivityIndicator color="#4DA58E" />
      </View>
    );
  }

  if (!results || results.length === 0) {
    return null;
  }

  return (
    <View>
      {results.map((item, index) => (
        <TouchableOpacity
          key={item.fdcId || item.customFoodId || `${item.description}-${index}`}
          onPress={() => onSelect(item)}
          className="bg-surface"
          style={{
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#2A2E3D",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: item.source === "custom" ? "#4DA58E30" : "#438DD530",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  color: item.source === "custom" ? "#4DA58E" : "#438DD5",
                }}
              >
                {item.source === "custom" ? "MY FOOD" : "USDA"}
              </Text>
            </View>
            <Text
              className="text-primary"
              style={{ flex: 1, fontSize: 14, fontWeight: "500" }}
              numberOfLines={1}
            >
              {item.description}
            </Text>
          </View>
          <View style={{ flexDirection: "row", marginTop: 4, gap: 12 }}>
            {item.brandName && (
              <Text className="text-muted" style={{ fontSize: 12 }}>
                {item.brandName}
              </Text>
            )}
            <Text className="text-secondary" style={{ fontSize: 12 }}>
              {Math.round(item.calories)} cal
            </Text>
            <Text className="text-muted" style={{ fontSize: 12 }}>
              per {item.servingUnit.length > 3 ? item.servingUnit : `${item.servingSize}${item.servingUnit}`}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
