import { useState, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const MEAL_OPTIONS = [
  { value: "BREAKFAST", label: "Breakfast", icon: "weather-sunny" },
  { value: "LUNCH", label: "Lunch", icon: "food" },
  { value: "DINNER", label: "Dinner", icon: "food-variant" },
  { value: "SNACK", label: "Snack", icon: "cookie" },
];

function getDefaultMealCategory() {
  const hour = new Date().getHours();
  if (hour < 11) return "BREAKFAST";
  if (hour < 15) return "LUNCH";
  if (hour < 20) return "DINNER";
  return "SNACK";
}

export default function AddFoodModal({ visible, onClose, food, onSave, isSaving }) {
  const [servingQty, setServingQty] = useState("1");
  const [mealCategory, setMealCategory] = useState(getDefaultMealCategory());

  const qty = parseFloat(servingQty) || 0;

  const computed = useMemo(() => {
    if (!food) return { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    return {
      calories: Math.round(food.calories * qty),
      proteinG: Math.round(food.proteinG * qty * 10) / 10,
      carbsG: Math.round(food.carbsG * qty * 10) / 10,
      fatG: Math.round(food.fatG * qty * 10) / 10,
    };
  }, [food, qty]);

  const handleSave = () => {
    if (!food || qty <= 0) return;

    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    onSave({
      date,
      mealCategory,
      foodName: food.description,
      fdcId: food.fdcId || null,
      customFoodId: food.customFoodId || null,
      servingQty: qty,
      servingSize: food.servingSize,
      servingUnit: food.servingUnit,
      calories: computed.calories,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
    });
  };

  if (!food) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View className="bg-background flex-1">
        {/* Header */}
        <View
          className="bg-surface"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 48,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={onClose}>
            <Text className="text-secondary" style={{ fontSize: 16 }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text
            className="text-primary"
            style={{ fontSize: 17, fontWeight: "600" }}
          >
            Add Food
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving || qty <= 0}>
            {isSaving ? (
              <ActivityIndicator color="#4DA58E" size="small" />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: qty > 0 ? "#4DA58E" : "#5C6379",
                }}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }}>
          {/* Food name */}
          <Text
            className="text-primary"
            style={{ fontSize: 18, fontWeight: "600", marginBottom: 4 }}
          >
            {food.description}
          </Text>
          {food.brandName && (
            <Text className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              {food.brandName}
            </Text>
          )}

          {/* Serving size */}
          <View
            className="bg-surface"
            style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}
          >
            <Text
              className="text-secondary"
              style={{ fontSize: 13, marginBottom: 8 }}
            >
              Servings
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <TextInput
                value={servingQty}
                onChangeText={setServingQty}
                keyboardType="decimal-pad"
                className="bg-surface-elevated text-primary"
                style={{
                  width: 80,
                  height: 44,
                  borderRadius: 8,
                  textAlign: "center",
                  fontSize: 18,
                  fontWeight: "600",
                }}
              />
              <Text className="text-secondary" style={{ fontSize: 14 }}>
                × {food.servingUnit.length > 3 ? `${food.servingUnit} (${food.servingSize}g)` : `${food.servingSize}${food.servingUnit}`}
              </Text>
            </View>
          </View>

          {/* Meal category */}
          <View
            className="bg-surface"
            style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}
          >
            <Text
              className="text-secondary"
              style={{ fontSize: 13, marginBottom: 12 }}
            >
              Meal
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {MEAL_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setMealCategory(option.value)}
                  className={
                    mealCategory === option.value
                      ? "bg-accent"
                      : "bg-surface-elevated"
                  }
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={18}
                    color={
                      mealCategory === option.value ? "#E8ECF4" : "#9BA3B5"
                    }
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color:
                        mealCategory === option.value ? "#E8ECF4" : "#9BA3B5",
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Nutrition preview */}
          <View
            className="bg-surface"
            style={{ borderRadius: 12, padding: 16 }}
          >
            <Text
              className="text-secondary"
              style={{ fontSize: 13, marginBottom: 12 }}
            >
              Nutrition
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <NutrientDisplay label="Calories" value={computed.calories} unit="cal" />
              <NutrientDisplay label="Protein" value={computed.proteinG} unit="g" />
              <NutrientDisplay label="Carbs" value={computed.carbsG} unit="g" />
              <NutrientDisplay label="Fat" value={computed.fatG} unit="g" />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function NutrientDisplay({ label, value, unit }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        className="text-primary"
        style={{ fontSize: 20, fontWeight: "700" }}
      >
        {value}
      </Text>
      <Text className="text-muted" style={{ fontSize: 11 }}>
        {unit}
      </Text>
      <Text className="text-secondary" style={{ fontSize: 11, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}
