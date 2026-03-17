import { View, Text } from "react-native";
import GradientBackground from "../../components/GradientBackground";

export default function NutritionScreen() {
  return (
    <GradientBackground>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-base text-secondary">
          This is the nutrition page
        </Text>
      </View>
    </GradientBackground>
  );
}
