import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator } from "react-native";
import { useAuth0 } from "react-native-auth0";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import CoachCard from "../../components/CoachCard";
import WeeklySummaryCard from "../../components/WeeklySummaryCard";
import useCoachInsight from "../../hooks/useCoachInsight";

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user, clearSession } = useAuth0();
  const [menuOpen, setMenuOpen] = useState(false);
  const { insights, isLoading, isRecapLoading, error, isConnected, refetch, fetchRecap } = useCoachInsight();

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
    <GradientBackground>
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
      <ScrollView className="flex-1">
        <View className="px-6 pt-6">
          <Text className="text-2xl font-bold text-primary">
            Welcome, {user?.name || "User"}
          </Text>
        </View>

        {/* Insight states */}
        {isLoading && (
          <View className="items-center mt-8">
            <ActivityIndicator size="large" color="#4DA58E" />
            <Text className="text-sm text-secondary mt-3">Checking in with your coach...</Text>
          </View>
        )}

        {!isLoading && error && (
          <View className="bg-surface rounded-xl p-5 mx-6 mt-4 items-center">
            <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#C4555A" />
            <Text className="text-sm text-secondary mt-2 text-center">{error}</Text>
            <Pressable
              onPress={refetch}
              accessibilityRole="button"
              accessibilityLabel="Retry"
              className="bg-accent rounded-lg px-4 py-2 mt-3"
            >
              <Text className="text-sm font-semibold text-primary">Retry</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && !isConnected && (
          <View className="bg-surface rounded-xl p-5 mx-6 mt-4 items-center">
            <MaterialCommunityIcons name="watch" size={32} color="#5C6379" />
            <Text className="text-base font-semibold text-primary mt-3">
              Connect your Fitbit
            </Text>
            <Text className="text-sm text-secondary mt-1 text-center">
              Link your Fitbit to unlock daily insights and personalized guidance.
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Fitbit")}
              accessibilityRole="button"
              accessibilityLabel="Go to Fitbit"
              className="bg-accent rounded-lg px-5 py-2.5 mt-4"
            >
              <Text className="text-sm font-semibold text-primary">Get Started</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !error && isConnected && insights && (
          <>
            <CoachCard insights={insights} onRecap={fetchRecap} isRecapLoading={isRecapLoading} />
            <WeeklySummaryCard />
          </>
        )}

        {!isLoading && !error && isConnected && !insights && (
          <View className="bg-surface rounded-xl p-5 mx-6 mt-4 items-center">
            <MaterialCommunityIcons name="clock-outline" size={28} color="#5C6379" />
            <Text className="text-sm text-secondary mt-2 text-center">
              No data yet today. Wear your Fitbit and check back later.
            </Text>
          </View>
        )}

      </ScrollView>

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
    </GradientBackground>
  );
}
