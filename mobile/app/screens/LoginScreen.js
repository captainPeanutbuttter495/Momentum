import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useAuth0 } from "react-native-auth0";
import { useState } from "react";

export default function LoginScreen() {
  const { authorize, error } = useAuth0();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await authorize(
        { scope: "openid profile email" },
        { customScheme: "momentum" }
      );
    } catch (e) {
      console.error("Login error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-3xl font-bold text-primary mb-2">Momentum</Text>
      <Text className="text-base text-secondary mb-10">
        Track your nutrition, workouts, and sleep
      </Text>

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="w-full bg-accent rounded-xl py-4 items-center"
        accessibilityRole="button"
        accessibilityLabel="Sign in with Google"
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white text-lg font-semibold">
            Sign in with Google
          </Text>
        )}
      </Pressable>

      {error && (
        <Text className="text-error mt-4 text-center">
          {error.message || "Login failed. Please try again."}
        </Text>
      )}
    </View>
  );
}
