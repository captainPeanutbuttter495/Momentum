import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth0 } from "react-native-auth0";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import SelectionCard from "../../components/SelectionCard";
import StepProgressBar from "../../components/StepProgressBar";
import NumberInput from "../../components/NumberInput";
import MacroBar from "../../components/MacroBar";
import CalorieWarning from "../../components/CalorieWarning";
import { createApiClient } from "../../services/api";
import { createProfile } from "../../services/profile";
import {
  calculateBMR,
  calculateTDEE,
  calculateDailyCalorieTarget,
  getMacroSplit,
  calculateEstimatedWeeks,
} from "../../lib/nutrition-calc";
import { useOnboarding } from "../../context/OnboardingContext";

const GOALS = [
  { key: "LOSE_WEIGHT", title: "Lose Weight", icon: "scale-bathroom", description: "Burn fat and shed pounds" },
  { key: "MAINTAIN", title: "Maintain Weight", icon: "scale-balance", description: "Keep your current weight" },
  { key: "GAIN_MUSCLE", title: "Gain Muscle", icon: "dumbbell", description: "Build muscle and strength" },
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
  { value: 0.5, label: "0.5 lbs/week", description: "Slow & steady" },
  { value: 1, label: "1 lb/week", description: "Recommended" },
  { value: 1.5, label: "1.5 lbs/week", description: "Aggressive" },
  { value: 2, label: "2 lbs/week", description: "Maximum" },
];

const GAIN_RATES = [
  { value: 250, label: "Lean bulk", description: "+250 cal/day" },
  { value: 500, label: "Standard bulk", description: "+500 cal/day" },
];

export default function OnboardingScreen() {
  const { getCredentials } = useAuth0();
  const { onComplete } = useOnboarding();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

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

  const totalSteps = formData.goal === "MAINTAIN" ? 4 : 5;

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Compute results for step 5
  const computeResults = () => {
    const weight = parseFloat(formData.weightLbs);
    const feet = parseInt(formData.heightFeet, 10);
    const inches = parseInt(formData.heightInches, 10);
    const age = parseInt(formData.age, 10);
    if (!weight || !feet || isNaN(inches) || !age || !formData.gender || !formData.activityLevel) return null;

    const bmr = calculateBMR({ weightLbs: weight, heightFeet: feet, heightInches: inches, age, gender: formData.gender });
    const tdee = calculateTDEE(bmr, formData.activityLevel);
    return { bmr, tdee };
  };

  const getEffectiveStep = (s) => {
    // Skip step 4 (target weight) for Maintain
    if (formData.goal === "MAINTAIN" && s === 4) return 5;
    return s;
  };

  const handleNext = () => {
    let next = step + 1;
    if (formData.goal === "MAINTAIN" && next === 4) {
      updateField("targetWeightLbs", formData.weightLbs);
      updateField("weeklyRateLbs", 0);
      next = 5;
    }
    setStep(next);
  };

  const handleBack = () => {
    let prev = step - 1;
    if (formData.goal === "MAINTAIN" && prev === 4) {
      prev = 3;
    }
    setStep(prev);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
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
        targetWeightLbs: parseFloat(formData.targetWeightLbs),
        weeklyRateLbs: formData.weeklyRateLbs,
      };
      await createProfile(api, profileData);
      onComplete();
    } catch (err) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSubmitting(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.goal !== null;
      case 2:
        return (
          formData.age !== "" && parseInt(formData.age, 10) >= 13 &&
          formData.heightFeet !== "" && parseInt(formData.heightFeet, 10) >= 3 &&
          formData.heightInches !== "" && parseInt(formData.heightInches, 10) >= 0 &&
          formData.weightLbs !== "" && parseFloat(formData.weightLbs) >= 50 &&
          formData.gender !== null
        );
      case 3: return formData.activityLevel !== null;
      case 4: return formData.targetWeightLbs !== "" && parseFloat(formData.targetWeightLbs) >= 50;
      case 5: return formData.goal === "MAINTAIN" || formData.weeklyRateLbs !== null;
      default: return false;
    }
  };

  const isLastStep = step === 5 || (formData.goal === "MAINTAIN" && step === 4);
  const effectiveStep = formData.goal === "MAINTAIN" && step === 5 ? 4 : step;

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 pt-14 px-6 pb-6">
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            {step > 1 && (
              <Pressable onPress={handleBack} testID="back-button" style={{ marginRight: 12 }}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#E8ECF4" />
              </Pressable>
            )}
            <Text className="text-primary text-xl font-bold" style={{ flex: 1 }}>
              {step === 1 && "What's your goal?"}
              {step === 2 && "About you"}
              {step === 3 && "Activity level"}
              {step === 4 && "Target weight"}
              {step === 5 && "Your plan"}
            </Text>
            <Text className="text-muted text-sm">
              {effectiveStep} of {totalSteps}
            </Text>
          </View>

          <StepProgressBar totalSteps={totalSteps} currentStep={effectiveStep} />

          {/* Content */}
          <ScrollView
            className="flex-1 mt-6"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && <GoalStep goal={formData.goal} onSelect={(g) => updateField("goal", g)} />}
            {step === 2 && <BodyInfoStep formData={formData} updateField={updateField} />}
            {step === 3 && <ActivityStep activityLevel={formData.activityLevel} onSelect={(l) => updateField("activityLevel", l)} />}
            {step === 4 && <TargetWeightStep formData={formData} updateField={updateField} />}
            {step === 5 && <ResultsStep formData={formData} computeResults={computeResults} updateField={updateField} />}

            {error && (
              <View className="bg-error/20 rounded-xl p-3 mt-4">
                <Text className="text-error text-sm">{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Button */}
          <Pressable
            onPress={step === 5 ? handleSubmit : handleNext}
            disabled={!isStepValid() || submitting}
            testID={step === 5 ? "get-started-button" : "next-button"}
            className={`rounded-xl py-4 items-center mt-4 ${
              isStepValid() && !submitting ? "bg-accent" : "bg-accent/40"
            }`}
          >
            {submitting ? (
              <ActivityIndicator color="#E8ECF4" />
            ) : (
              <Text className="text-primary text-lg font-semibold">
                {step === 5 ? "Get Started" : "Next"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

function GoalStep({ goal, onSelect }) {
  return (
    <View style={{ gap: 12 }}>
      {GOALS.map((g) => (
        <SelectionCard
          key={g.key}
          icon={g.icon}
          title={g.title}
          description={g.description}
          selected={goal === g.key}
          onPress={() => onSelect(g.key)}
          testID={`goal-${g.key}`}
        />
      ))}
    </View>
  );
}

function BodyInfoStep({ formData, updateField }) {
  return (
    <View style={{ gap: 16 }}>
      <NumberInput
        label="Age"
        value={formData.age}
        onChangeText={(v) => updateField("age", v)}
        placeholder="25"
        suffix="years"
        testID="input-age"
      />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <NumberInput
            label="Height"
            value={formData.heightFeet}
            onChangeText={(v) => updateField("heightFeet", v)}
            placeholder="5"
            suffix="ft"
            testID="input-height-feet"
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberInput
            label=" "
            value={formData.heightInches}
            onChangeText={(v) => updateField("heightInches", v)}
            placeholder="10"
            suffix="in"
            testID="input-height-inches"
          />
        </View>
      </View>
      <NumberInput
        label="Weight"
        value={formData.weightLbs}
        onChangeText={(v) => updateField("weightLbs", v)}
        placeholder="180"
        suffix="lbs"
        testID="input-weight"
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
              testID={`gender-${g.key}`}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function ActivityStep({ activityLevel, onSelect }) {
  return (
    <View style={{ gap: 12 }}>
      {ACTIVITY_LEVELS.map((level) => (
        <SelectionCard
          key={level.value}
          title={level.title}
          description={level.description}
          selected={activityLevel === level.value}
          onPress={() => onSelect(level.value)}
          testID={`activity-${level.value}`}
        />
      ))}
    </View>
  );
}

function TargetWeightStep({ formData, updateField }) {
  const current = parseFloat(formData.weightLbs) || 0;
  const target = parseFloat(formData.targetWeightLbs) || 0;
  const diff = Math.abs(current - target);
  const direction = formData.goal === "GAIN_MUSCLE" ? "gain" : "lose";

  return (
    <View style={{ gap: 16 }}>
      <NumberInput
        label="Target weight"
        value={formData.targetWeightLbs}
        onChangeText={(v) => updateField("targetWeightLbs", v)}
        placeholder="170"
        suffix="lbs"
        testID="input-target-weight"
      />
      {target > 0 && current > 0 && target !== current && (
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-secondary text-sm">
            You want to {direction}{" "}
            <Text className="text-primary font-semibold">{diff.toFixed(1)} lbs</Text>
          </Text>
        </View>
      )}
    </View>
  );
}

function ResultsStep({ formData, computeResults, updateField }) {
  const results = computeResults();
  if (!results) return null;

  const { bmr, tdee } = results;
  const targetWeight = parseFloat(formData.targetWeightLbs) || 0;

  const rates = formData.goal === "LOSE_WEIGHT" ? LOSE_RATES : formData.goal === "GAIN_MUSCLE" ? GAIN_RATES : [];

  const selectedRate = formData.weeklyRateLbs;
  const dailyCalories = formData.goal === "MAINTAIN"
    ? Math.round(tdee)
    : selectedRate !== null
      ? calculateDailyCalorieTarget({ tdee, goal: formData.goal, weeklyRateLbs: selectedRate })
      : null;

  const macros = dailyCalories !== null
    ? getMacroSplit({ dailyCalories, targetWeightLbs: targetWeight })
    : null;

  const currentWeight = parseFloat(formData.weightLbs) || 0;
  const estimatedWeeks =
    formData.goal === "LOSE_WEIGHT" && selectedRate
      ? calculateEstimatedWeeks({ currentWeightLbs: currentWeight, targetWeightLbs: targetWeight, weeklyRateLbs: selectedRate })
      : null;

  return (
    <View style={{ gap: 16 }}>
      {/* BMR & TDEE */}
      <View className="bg-surface rounded-xl p-4" style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text className="text-secondary text-sm">Your BMR</Text>
          <Text className="text-primary font-semibold">{Math.round(bmr).toLocaleString()} cal/day</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text className="text-secondary text-sm">Maintenance (TDEE)</Text>
          <Text className="text-primary font-semibold">{Math.round(tdee).toLocaleString()} cal/day</Text>
        </View>
      </View>

      {/* Rate Selection */}
      {rates.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text className="text-secondary text-sm">
            {formData.goal === "LOSE_WEIGHT" ? "Choose your deficit" : "Choose your surplus"}
          </Text>
          {rates.map((rate) => {
            const cal = calculateDailyCalorieTarget({ tdee, goal: formData.goal, weeklyRateLbs: rate.value });
            return (
              <SelectionCard
                key={rate.value}
                title={`${rate.label} — ${cal.toLocaleString()} cal/day`}
                description={rate.description}
                selected={selectedRate === rate.value}
                onPress={() => updateField("weeklyRateLbs", rate.value)}
                testID={`rate-${rate.value}`}
              />
            );
          })}
        </View>
      )}

      {/* Maintain display */}
      {formData.goal === "MAINTAIN" && (
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-secondary text-sm">Your daily calorie target</Text>
          <Text className="text-accent text-2xl font-bold mt-1">
            {Math.round(tdee).toLocaleString()} cal/day
          </Text>
        </View>
      )}

      {/* Safety Warning */}
      {dailyCalories !== null && (
        <CalorieWarning calorieTarget={dailyCalories} gender={formData.gender} />
      )}

      {/* Macro Split */}
      {macros !== null && (
        <View style={{ gap: 8 }}>
          <Text className="text-secondary text-sm">Recommended macros</Text>
          <View className="bg-surface rounded-xl p-4">
            <MacroBar
              proteinPct={macros.proteinPct}
              carbPct={macros.carbPct}
              fatPct={macros.fatPct}
              proteinGrams={macros.proteinGrams}
              carbGrams={macros.carbGrams}
              fatGrams={macros.fatGrams}
            />
          </View>
        </View>
      )}

      {/* Timeline */}
      {estimatedWeeks !== null && (
        <View className="bg-surface rounded-xl p-4">
          <Text className="text-secondary text-sm">Estimated timeline</Text>
          <Text className="text-primary font-semibold mt-1">
            ~{estimatedWeeks} weeks to reach {targetWeight} lbs
          </Text>
        </View>
      )}
    </View>
  );
}
