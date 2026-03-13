import { View, Text, Pressable, Modal } from "react-native";
import { useAuth0 } from "react-native-auth0";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, clearSession } = useAuth0();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await clearSession({}, { customScheme: "momentum" });
    } catch (e) {
      if (e.message?.includes("user_cancelled")) return;
      console.error("Logout error:", e);
    }
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <Pressable
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          className="p-2"
        >
          <MaterialCommunityIcons name="menu" size={24} color="#E8ECF4" />
        </Pressable>
        <Text className="text-lg font-semibold text-primary ml-3">
          Momentum
        </Text>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-6">
        <Text className="text-2xl font-bold text-primary">
          Welcome, {user?.name || "User"}
        </Text>
      </View>

      {/* Hamburger Menu */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          className="flex-1"
          onPress={() => setMenuOpen(false)}
        >
          <View className="bg-surface-elevated rounded-lg mt-24 ml-4 p-2 w-48"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}
          >
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate("Profile");
              }}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              className="flex-row items-center px-3 py-3 rounded-md"
            >
              <MaterialCommunityIcons name="account-circle-outline" size={20} color="#9BA3B5" />
              <Text className="text-sm text-primary ml-3">Profile</Text>
            </Pressable>

            <View className="h-px bg-border mx-2" />

            <Pressable
              onPress={handleLogout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              className="flex-row items-center px-3 py-3 rounded-md"
            >
              <MaterialCommunityIcons name="logout" size={20} color="#C4555A" />
              <Text className="text-sm text-error ml-3">Log Out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
