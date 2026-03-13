import { View, Text, Animated, Easing } from "react-native";
import { useAuth0 } from "react-native-auth0";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import ProgressRing from "../../components/ProgressRing";
import HealthIcons from "../../components/HealthIcons";
import GlowButton from "../../components/GlowButton";

export default function LoginScreen() {
  const { authorize, error } = useAuth0();
  const [loading, setLoading] = useState(false);

  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const driftAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 10000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 10000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    driftAnim.start();

    return () => driftAnim.stop();
  }, []);

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

  const driftY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.4],
  });

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#0F1117", "#161A24", "#1A1D27", "#0F1117"]}
        locations={[0, 0.3, 0.6, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <LinearGradient
          colors={["transparent", "#4DA58E08", "transparent"]}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 1, y: 0.7 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-10">
          <ProgressRing />
        </View>

        <Text className="text-3xl font-bold text-primary mb-1">Momentum</Text>

        <Text className="text-sm text-secondary mb-1 text-center">
          Build healthy habits.
        </Text>
        <Text className="text-xs text-muted mb-10 text-center">
          Track workouts, nutrition, and recovery in one place.
        </Text>

        <HealthIcons />

        <GlowButton
          onPress={handleLogin}
          disabled={loading}
          loading={loading}
          accessibilityLabel="Sign in with Google"
        />

        {error && (
          <Text className="text-error mt-4 text-center">
            {error.message || "Login failed. Please try again."}
          </Text>
        )}
      </View>
    </View>
  );
}
