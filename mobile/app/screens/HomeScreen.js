import { View, Text, Pressable } from "react-native";
import { useAuth0 } from "react-native-auth0";

export default function HomeScreen() {
  const { user, clearSession } = useAuth0();

  const handleLogout = async () => {
    try {
      await clearSession({}, { customScheme: "momentum" });
    } catch (e) {
      if (e.message?.includes("user_cancelled")) return;
      console.error("Logout error:", e);
    }
  };

  return (
    <View className="flex-1 bg-background px-6 pt-16">
      <Text className="text-2xl font-bold text-primary">
        Welcome, {user?.name || user?.email || "User"}
      </Text>
      <Text className="text-base text-secondary mt-1">{user?.email}</Text>

      <Pressable
        onPress={handleLogout}
        className="mt-8 bg-error rounded-xl py-3 items-center"
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text className="text-white text-base font-semibold">Log Out</Text>
      </Pressable>
    </View>
  );
}
