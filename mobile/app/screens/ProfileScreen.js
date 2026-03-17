import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";

export default function ProfileScreen() {
  const navigation = useNavigation();

  return (
    <GradientBackground>
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
        <Text className="text-lg font-semibold text-primary ml-3">
          Profile
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-base text-secondary">
          This is the profile page
        </Text>
      </View>
    </GradientBackground>
  );
}
