import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import CalorieRing from "../../components/CalorieRing";
import MacroProgressBars from "../../components/MacroProgressBars";
import FoodSearchBar from "../../components/FoodSearchBar";
import FoodSearchResults from "../../components/FoodSearchResults";
import MealSection from "../../components/MealSection";
import AddFoodModal from "../../components/AddFoodModal";
import CustomFoodForm from "../../components/CustomFoodForm";
import NutritionLabelScanner from "../../components/NutritionLabelScanner";
import useNutrition from "../../hooks/useNutrition";

const MEAL_ORDER = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export default function NutritionScreen() {
  const {
    summary,
    foodLog,
    isLoading,
    isSaving,
    error,
    addFoodEntry,
    removeEntry,
    searchFoods,
    createCustomFood,
    scanLabel,
    refetch,
  } = useNutrition();

  // Search state
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [customOnly, setCustomOnly] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

  // Modal state
  const [selectedFood, setSelectedFood] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [customFormVisible, setCustomFormVisible] = useState(false);
  const [customFormData, setCustomFormData] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  // Meal section expand state
  const [expandedMeals, setExpandedMeals] = useState({
    BREAKFAST: true,
    LUNCH: true,
    DINNER: true,
    SNACK: true,
  });

  const handleSearch = useCallback(
    async (query) => {
      if (!query) {
        setSearchResults([]);
        setSearchActive(false);
        return;
      }
      setSearchActive(true);
      setIsSearching(true);
      try {
        const results = await searchFoods(query, customOnly);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchFoods, customOnly],
  );

  const handleSelectFood = useCallback((food) => {
    setSelectedFood(food);
    setAddModalVisible(true);
  }, []);

  const handleSaveEntry = useCallback(
    async (entry) => {
      try {
        await addFoodEntry(entry);
        setAddModalVisible(false);
        setSelectedFood(null);
        setSearchResults([]);
        setSearchActive(false);
      } catch (err) {
        Alert.alert("Error", "Failed to log food. Please try again.");
      }
    },
    [addFoodEntry],
  );

  const handleDeleteEntry = useCallback(
    async (id) => {
      Alert.alert("Delete Entry", "Remove this food from your log?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeEntry(id);
            } catch (err) {
              Alert.alert("Error", "Failed to delete entry.");
            }
          },
        },
      ]);
    },
    [removeEntry],
  );

  const handleAddFromMeal = useCallback((category) => {
    // Focus the search — user picks from results
    setSearchActive(true);
  }, []);

  const handleToggleMeal = useCallback((category) => {
    setExpandedMeals((prev) => ({ ...prev, [category]: !prev[category] }));
  }, []);

  const handleScanComplete = useCallback(
    async (photoBase64, mediaType) => {
      setIsScanning(true);
      try {
        const extracted = await scanLabel(photoBase64, mediaType);
        setCustomFormData({ ...extracted, photoBase64, photoMediaType: mediaType });
        setCustomFormVisible(true);
      } catch (err) {
        Alert.alert("Scan Failed", "Could not read the nutrition label. Please try again or enter manually.");
      } finally {
        setIsScanning(false);
      }
    },
    [scanLabel],
  );

  const handleSaveCustomFood = useCallback(
    async (data) => {
      try {
        await createCustomFood(data);
        setCustomFormVisible(false);
        setCustomFormData(null);
        Alert.alert("Saved", "Custom food created. You can now search for it.");
      } catch (err) {
        Alert.alert("Error", "Failed to save custom food.");
      }
    },
    [createCustomFood],
  );

  const handleCreateCustom = useCallback(() => {
    setCustomFormData(null);
    setCustomFormVisible(true);
  }, []);

  const handleAction = useCallback(() => {
    Alert.alert("Add Food", "Choose an option", [
      { text: "Search Food", onPress: () => setSearchActive(true) },
      { text: "Create Custom Food", onPress: handleCreateCustom },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleCreateCustom]);

  // Group food log by meal category
  const logByMeal = {};
  for (const category of MEAL_ORDER) {
    logByMeal[category] = foodLog.filter((e) => e.mealCategory === category);
  }

  const consumed = summary?.consumed || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const targets = summary?.targets || { calories: 2000, proteinG: 150, carbsG: 200, fatG: 65 };

  if (isLoading) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator testID="activity-indicator" color="#4DA58E" size="large" />
        </View>
      </GradientBackground>
    );
  }

  if (!summary) {
    return (
      <GradientBackground>
        <View className="flex-1 items-center justify-center px-6">
          <MaterialCommunityIcons name="food-apple-outline" size={48} color="#5C6379" />
          <Text className="text-secondary text-base mt-4 text-center">
            Set up your profile to start tracking nutrition
          </Text>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      {/* Header */}
      <View
        className="border-b border-border"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 52,
          paddingBottom: 12,
        }}
      >
        <Text className="text-primary" style={{ fontSize: 22, fontWeight: "700" }}>
          Nutrition
        </Text>
        <TouchableOpacity onPress={handleAction}>
          <MaterialCommunityIcons name="plus-circle" size={28} color="#4DA58E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress section */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 20,
            marginBottom: 20,
          }}
        >
          <CalorieRing consumed={consumed.calories} target={targets.calories} />
          <View style={{ flex: 1 }}>
            <MacroProgressBars consumed={consumed} targets={targets} />
          </View>
        </View>

        {/* Search bar */}
        <View style={{ marginBottom: 16 }}>
          <FoodSearchBar
            onSearch={handleSearch}
            customOnly={customOnly}
            onToggleCustomOnly={() => setCustomOnly((prev) => !prev)}
          />
        </View>

        {/* Scan label button */}
        <View style={{ marginBottom: 16 }}>
          <NutritionLabelScanner
            onScanComplete={handleScanComplete}
            isScanning={isScanning}
          />
        </View>

        {/* Search results */}
        {searchActive && (
          <View
            className="bg-surface"
            style={{ borderRadius: 12, marginBottom: 16, overflow: "hidden" }}
          >
            <FoodSearchResults
              results={searchResults}
              onSelect={handleSelectFood}
              isLoading={isSearching}
            />
            {!isSearching && searchResults.length === 0 && searchActive && (
              <View style={{ padding: 16, alignItems: "center" }}>
                <Text className="text-muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  No results found
                </Text>
                <TouchableOpacity onPress={handleCreateCustom}>
                  <Text style={{ fontSize: 13, color: "#4DA58E", fontWeight: "500" }}>
                    Create Custom Food
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Meal sections */}
        <View style={{ gap: 12 }}>
          {MEAL_ORDER.map((category) => (
            <MealSection
              key={category}
              category={category}
              entries={logByMeal[category]}
              expanded={expandedMeals[category]}
              onToggle={() => handleToggleMeal(category)}
              onAddFood={handleAddFromMeal}
              onEditEntry={() => {}}
              onDeleteEntry={handleDeleteEntry}
            />
          ))}
        </View>
      </ScrollView>

      {/* Add Food Modal */}
      <AddFoodModal
        visible={addModalVisible}
        onClose={() => {
          setAddModalVisible(false);
          setSelectedFood(null);
        }}
        food={selectedFood}
        onSave={handleSaveEntry}
        isSaving={isSaving}
      />

      {/* Custom Food Form */}
      <CustomFoodForm
        visible={customFormVisible}
        onClose={() => {
          setCustomFormVisible(false);
          setCustomFormData(null);
        }}
        onSave={handleSaveCustomFood}
        initialData={customFormData}
        isSaving={isSaving}
      />
    </GradientBackground>
  );
}
