import { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";

const UNIT_OPTIONS = ["g", "oz", "ml", "piece", "cup", "tbsp", "tsp"];

export default function CustomFoodForm({
  visible,
  onClose,
  onSave,
  initialData,
  isSaving,
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [brand, setBrand] = useState(initialData?.brand || "");
  const [servingSize, setServingSize] = useState(
    initialData?.servingSize?.toString() || "",
  );
  const [servingUnit, setServingUnit] = useState(
    initialData?.servingUnit || "g",
  );
  const [calories, setCalories] = useState(
    initialData?.calories?.toString() || "",
  );
  const [proteinG, setProteinG] = useState(
    initialData?.proteinG?.toString() || "",
  );
  const [carbsG, setCarbsG] = useState(
    initialData?.carbsG?.toString() || "",
  );
  const [fatG, setFatG] = useState(initialData?.fatG?.toString() || "");

  const canSave =
    name.trim().length > 0 &&
    parseFloat(servingSize) > 0 &&
    parseFloat(calories) >= 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      brand: brand.trim() || null,
      servingSize: parseFloat(servingSize),
      servingUnit,
      calories: parseFloat(calories) || 0,
      proteinG: parseFloat(proteinG) || 0,
      carbsG: parseFloat(carbsG) || 0,
      fatG: parseFloat(fatG) || 0,
      photoBase64: initialData?.photoBase64 || null,
      photoMediaType: initialData?.photoMediaType || null,
    });
  };

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
            Custom Food
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#4DA58E" size="small" />
            ) : (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: canSave ? "#4DA58E" : "#5C6379",
                }}
              >
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          {/* Name & Brand */}
          <View className="bg-surface" style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <FormField label="Food Name *" value={name} onChangeText={setName} placeholder="e.g., Kirkland Protein Bar" />
            <FormField label="Brand" value={brand} onChangeText={setBrand} placeholder="e.g., Kirkland" />
          </View>

          {/* Serving Info */}
          <View className="bg-surface" style={{ borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>Serving Size</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={servingSize}
                  onChangeText={setServingSize}
                  keyboardType="decimal-pad"
                  placeholder="28"
                  placeholderTextColor="#5C6379"
                  className="bg-surface-elevated text-primary"
                  style={{ height: 44, borderRadius: 8, paddingHorizontal: 12, fontSize: 15 }}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, alignItems: "center" }}
              >
                {UNIT_OPTIONS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => setServingUnit(unit)}
                    className={servingUnit === unit ? "bg-accent" : "bg-surface-elevated"}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "500", color: servingUnit === unit ? "#E8ECF4" : "#9BA3B5" }}>
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Nutrition */}
          <View className="bg-surface" style={{ borderRadius: 12, padding: 16 }}>
            <Text className="text-secondary" style={{ fontSize: 13, marginBottom: 12 }}>Nutrition (per serving)</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <NutrientInput label="Cal" value={calories} onChangeText={setCalories} />
              <NutrientInput label="Protein" value={proteinG} onChangeText={setProteinG} />
              <NutrientInput label="Carbs" value={carbsG} onChangeText={setCarbsG} />
              <NutrientInput label="Fat" value={fatG} onChangeText={setFatG} />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function FormField({ label, value, onChangeText, placeholder }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text className="text-secondary" style={{ fontSize: 13, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#5C6379"
        className="bg-surface-elevated text-primary"
        style={{ height: 44, borderRadius: 8, paddingHorizontal: 12, fontSize: 15 }}
      />
    </View>
  );
}

function NutrientInput({ label, value, onChangeText }) {
  return (
    <View style={{ flex: 1 }}>
      <Text className="text-muted" style={{ fontSize: 11, marginBottom: 4, textAlign: "center" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#5C6379"
        className="bg-surface-elevated text-primary"
        style={{ height: 40, borderRadius: 8, textAlign: "center", fontSize: 15 }}
      />
    </View>
  );
}
