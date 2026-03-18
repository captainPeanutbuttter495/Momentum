import { View } from "react-native";

export default function StepProgressBar({ totalSteps, currentStep }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          testID={`step-dot-${i + 1}`}
          className={`rounded-full ${
            i + 1 === currentStep
              ? "bg-accent"
              : i + 1 < currentStep
                ? "bg-accent-muted"
                : "bg-border"
          }`}
          style={{ width: i + 1 === currentStep ? 24 : 8, height: 8 }}
        />
      ))}
    </View>
  );
}
