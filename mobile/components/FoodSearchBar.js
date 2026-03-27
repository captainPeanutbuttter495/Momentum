import { useState, useRef, useCallback } from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function FoodSearchBar({ onSearch, customOnly, onToggleCustomOnly }) {
  const [query, setQuery] = useState("");
  const timerRef = useRef(null);

  const handleChange = useCallback(
    (text) => {
      setQuery(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (text.trim().length > 0) {
          onSearch(text.trim());
        } else {
          onSearch("");
        }
      }, 300);
    },
    [onSearch],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onSearch("");
  }, [onSearch]);

  return (
    <View style={{ gap: 8 }}>
      <View
        className="bg-surface border-border"
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 12,
          borderWidth: 1,
          paddingHorizontal: 12,
          height: 44,
        }}
      >
        <MaterialCommunityIcons name="magnify" size={20} color="#5C6379" />
        <TextInput
          value={query}
          onChangeText={handleChange}
          placeholder="Search foods..."
          placeholderTextColor="#5C6379"
          className="text-primary"
          style={{ flex: 1, marginLeft: 8, fontSize: 15 }}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#5C6379" />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={onToggleCustomOnly}
          className={customOnly ? "bg-accent" : "bg-surface-elevated"}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
          }}
        >
          <Text
            className={customOnly ? "text-primary" : "text-secondary"}
            style={{ fontSize: 12, fontWeight: "600" }}
          >
            My Foods
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
