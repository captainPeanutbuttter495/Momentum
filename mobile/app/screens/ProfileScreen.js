import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth0 } from "react-native-auth0";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import SelectionCard from "../../components/SelectionCard";
import NumberInput from "../../components/NumberInput";
import MacroBar from "../../components/MacroBar";
import CalorieWarning from "../../components/CalorieWarning";
import { createApiClient } from "../../services/api";
import { getProfile, updateProfile } from "../../services/profile";
import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalorieTarget,
  getMacroSplit,
  calculateEstimatedWeeks,
} from "../../lib/nutrition-calc";

const GOALS = [
  { key: "LOSE_WEIGHT", title: "Lose Weight", icon: "scale-bathroom" },
  { key: "MAINTAIN", title: "Maintain Weight", icon: "scale-balance" },
  { key: "GAIN_MUSCLE", title: "Gain Muscle", icon: "dumbbell" },
];

const ACTIVITY_LEVELS = [
  { value: 1.2, title: "Sedentary", description: "Desk job, little to no exercise" },
  { value: 1.375, title: "Lightly Active", description: "Light exercise 1-3 days/week" },
  { value: 1.55, title: "Moderately Active", description: "Moderate exercise 3-5 days/week" },
  { value: 1.725, title: "Very Active", description: "Hard exercise 6-7 days/week" },
];

const GENDERS = [
  { key: "MALE", title: "Male", icon: "gender-male" },
  { key: "FEMALE", title: "Female", icon: "gender-female" },
];

const LOSE_RATES = [
  { value: 0.5, label: "0.5 lbs/week" },
  { value: 1, label: "1 lb/week" },
  { value: 1.5, label: "1.5 lbs/week" },
  { value: 2, label: "2 lbs/week" },
];

const GAIN_RATES = [
  { value: 250, label: "Lean bulk (+250 cal/day)" },
  { value: 500, label: "Standard bulk (+500 cal/day)" },
];

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { getCredentials } = useAuth0();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    goal: null,
    age: "",
    heightFeet: "",
    heightInches: "",
    weightLbs: "",
    gender: null,
    activityLevel: null,
    targetWeightLbs: "",
    weeklyRateLbs: null,
  });

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSuccess(false);
  };

  useEffect(() => {
    async function loadProfile() {
      try {
        if (typeof getCredentials !== "function") {
          setLoading(false);
          return;
        }
        const credentials = await getCredentials();
        const api = createApiClient(credentials.accessToken);
        const profile = await getProfile(api);
        setFormData({
          goal: profile.goal,
          age: String(profile.age),
          heightFeet: String(profile.heightFeet),
          heightInches: String(profile.heightInches),
          weightLbs: String(profile.weightLbs),
          gender: profile.gender,
          activityLevel: profile.activityLevel,
          targetWeightLbs: String(profile.targetWeightLbs),
          weeklyRateLbs: profile.weeklyRateLbs,
        });
      } catch {
        // Profile not loaded — show empty form
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [getCredentials]);

  const computeResults = useCallback(() => {
    const weight = parseFloat(formData.weightLbs);
    const feet = parseInt(formData.heightFeet, 10);
    const inches = parseInt(formData.heightInches, 10);
    const age = parseInt(formData.age, 10);
    if (!weight || !feet || isNaN(inches) || !age || !formData.gender || !formData.activityLevel) return null;

    const bmr = calculateBMR({ weightLbs: weight, heightFeet: feet, heightInches: inches, age, gender: formData.gender });
    const tdee = calculateTDEE(bmr, formData.activityLevel);
    const dailyCalorieTarget =
      formData.goal === "MAINTAIN" || formData.weeklyRateLbs == null
        ? Math.round(tdee)
        : calculateDailyCalorieTarget({ tdee, goal: formData.goal, weeklyRateLbs: formData.weeklyRateLbs });
    const targetWeight = formData.goal === "MAINTAIN"
      ? weight
      : parseFloat(formData.targetWeightLbs) || weight;
    const macros = getMacroSplit({ dailyCalories: dailyCalorieTarget, targetWeightLbs: targetWeight });
    return { bmr, tdee, dailyCalorieTarget, ...macros };
  }, [formData]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const credentials = await getCredentials();
      const api = createApiClient(credentials.accessToken);
      const profileData = {
        goal: formData.goal,
        age: parseInt(formData.age, 10),
        heightFeet: parseInt(formData.heightFeet, 10),
        heightInches: parseInt(formData.heightInches, 10),
        weightLbs: parseFloat(formData.weightLbs),
        gender: formData.gender,
        activityLevel: formData.activityLevel,
        targetWeightLbs: formData.goal === "MAINTAIN"
          ? parseFloat(formData.weightLbs)
          : parseFloat(formData.targetWeightLbs),
        weeklyRateLbs: formData.goal === "MAINTAIN" ? 0 : formData.weeklyRateLbs,
      };
      await updateProfile(api, profileData);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const results = computeResults();
  const rates = formData.goal === "LOSE_WEIGHT" ? LOSE_RATES : formData.goal === "GAIN_MUSCLE" ? GAIN_RATES : [];

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="p-2"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#E8ECF4" />
          </Pressable>
          <Text className="text-lg font-semibold text-primary ml-3">Profile</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#4DA58E" />
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-6 pt-4"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Goal */}
            <Text className="text-secondary text-sm mb-2">Goal</Text>
            <View style={{ gap: 8 }}>
              {GOALS.map((g) => (
                <SelectionCard
                  key={g.key}
                  icon={g.icon}
                  title={g.title}
                  selected={formData.goal === g.key}
                  onPress={() => updateField("goal", g.key)}
                  testID={`profile-goal-${g.key}`}
                />
              ))}
            </View>

            {/* Body Info */}
            <Text className="text-secondary text-sm mt-6 mb-2">Body Info</Text>
            <View style={{ gap: 12 }}>
              <NumberInput
                label="Age"
                value={formData.age}
                onChangeText={(v) => updateField("age", v)}
                placeholder="25"
                suffix="years"
                testID="profile-input-age"
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <NumberInput
                    label="Height"
                    value={formData.heightFeet}
                    onChangeText={(v) => updateField("heightFeet", v)}
                    placeholder="5"
                    suffix="ft"
                    testID="profile-input-height-feet"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberInput
                    label=" "
                    value={formData.heightInches}
                    onChangeText={(v) => updateField("heightInches", v)}
                    placeholder="10"
                    suffix="in"
                    testID="profile-input-height-inches"
                  />
                </View>
              </View>
              <NumberInput
                label="Weight"
                value={formData.weightLbs}
                onChangeText={(v) => updateField("weightLbs", v)}
                placeholder="180"
                suffix="lbs"
                testID="profile-input-weight"
              />
              <Text className="text-secondary text-sm mb-1">Gender</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {GENDERS.map((g) => (
                  <View key={g.key} style={{ flex: 1 }}>
                    <SelectionCard
                      icon={g.icon}
                      title={g.title}
                      selected={formData.gender === g.key}
                      onPress={() => updateField("gender", g.key)}
                      testID={`profile-gender-${g.key}`}
                    />
                  </View>
                ))}
              </View>
            </View>

            {/* Activity Level */}
            <Text className="text-secondary text-sm mt-6 mb-2">Activity Level</Text>
            <View style={{ gap: 8 }}>
              {ACTIVITY_LEVELS.map((level) => (
                <SelectionCard
                  key={level.value}
                  title={level.title}
                  description={level.description}
                  selected={formData.activityLevel === level.value}
                  onPress={() => updateField("activityLevel", level.value)}
                  testID={`profile-activity-${level.value}`}
                />
              ))}
            </View>

            {/* Target Weight (not for Maintain) */}
            {formData.goal !== "MAINTAIN" && (
              <>
                <Text className="text-secondary text-sm mt-6 mb-2">Target Weight</Text>
                <NumberInput
                  label=""
                  value={formData.targetWeightLbs}
                  onChangeText={(v) => updateField("targetWeightLbs", v)}
                  placeholder="170"
                  suffix="lbs"
                  testID="profile-input-target-weight"
                />
              </>
            )}

            {/* Rate */}
            {rates.length > 0 && (
              <>
                <Text className="text-secondary text-sm mt-6 mb-2">
                  {formData.goal === "LOSE_WEIGHT" ? "Weekly Loss Rate" : "Daily Surplus"}
                </Text>
                <View style={{ gap: 8 }}>
                  {rates.map((rate) => (
                    <SelectionCard
                      key={rate.value}
                      title={rate.label}
                      selected={formData.weeklyRateLbs === rate.value}
                      onPress={() => updateField("weeklyRateLbs", rate.value)}
                      testID={`profile-rate-${rate.value}`}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Computed Results */}
            {results && (
              <>
                <Text className="text-secondary text-sm mt-6 mb-2">Your Numbers</Text>
                <View className="bg-surface rounded-xl p-4" style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text className="text-secondary text-sm">BMR</Text>
                    <Text className="text-primary font-semibold">{Math.round(results.bmr).toLocaleString()} cal/day</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text className="text-secondary text-sm">TDEE</Text>
                    <Text className="text-primary font-semibold">{Math.round(results.tdee).toLocaleString()} cal/day</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text className="text-secondary text-sm">Daily Target</Text>
                    <Text className="text-accent text-lg font-bold">{results.dailyCalorieTarget.toLocaleString()} cal/day</Text>
                  </View>
                </View>

                <CalorieWarning calorieTarget={results.dailyCalorieTarget} gender={formData.gender} />

                <View className="bg-surface rounded-xl p-4 mt-3">
                  <MacroBar
                    proteinPct={results.proteinPct}
                    carbPct={results.carbPct}
                    fatPct={results.fatPct}
                    proteinGrams={results.proteinGrams}
                    carbGrams={results.carbGrams}
                    fatGrams={results.fatGrams}
                  />
                </View>

                {formData.goal === "LOSE_WEIGHT" && formData.weeklyRateLbs && (
                  <View className="bg-surface rounded-xl p-4 mt-3">
                    <Text className="text-secondary text-sm">Estimated timeline</Text>
                    <Text className="text-primary font-semibold mt-1">
                      ~{calculateEstimatedWeeks({
                        currentWeightLbs: parseFloat(formData.weightLbs),
                        targetWeightLbs: parseFloat(formData.targetWeightLbs),
                        weeklyRateLbs: formData.weeklyRateLbs,
                      })} weeks to reach {formData.targetWeightLbs} lbs
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Error / Success */}
            {error && (
              <View className="bg-error/20 rounded-xl p-3 mt-4">
                <Text className="text-error text-sm">{error}</Text>
              </View>
            )}
            {success && (
              <View className="bg-accent/20 rounded-xl p-3 mt-4">
                <Text className="text-accent text-sm">Profile updated successfully!</Text>
              </View>
            )}

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              disabled={saving}
              testID="save-profile-button"
              className={`rounded-xl py-4 items-center mt-6 mb-8 ${saving ? "bg-accent/40" : "bg-accent"}`}
            >
              {saving ? (
                <ActivityIndicator color="#E8ECF4" />
              ) : (
                <Text className="text-primary text-lg font-semibold">Save Changes</Text>
              )}
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
