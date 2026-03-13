import { useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import LoadingRing from "./LoadingRing";

export default function GlowButton({ onPress, disabled, loading, accessibilityLabel }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View className="w-full">
      <View
        style={{
          position: "absolute",
          top: -3,
          left: -3,
          right: -3,
          bottom: -3,
          backgroundColor: "#4DA58E15",
          borderRadius: 16,
          shadowColor: "#4DA58E",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 4,
        }}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          className="w-full bg-accent rounded-xl py-4 items-center"
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}
        >
          {loading ? (
            <LoadingRing />
          ) : (
            <>
              <MaterialCommunityIcons name="google" size={20} color="#E8ECF4" />
              <Text className="text-primary text-lg font-semibold">
                Sign in with Google
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
