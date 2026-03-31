import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth0 } from "react-native-auth0";
import { ActivityIndicator, View } from "react-native";

import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "../screens/ProfileScreen";
import WorkoutCalendarScreen from "../screens/WorkoutCalendarScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import MainTabNavigator from "./MainTabNavigator";
import OnboardingContext from "../../context/OnboardingContext";
import useProfileStatus from "../../hooks/useProfileStatus";

const Stack = createNativeStackNavigator();

const MomentumTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: "#4DA58E",
    background: "#0F1117",
    card: "#1A1D27",
    text: "#E8ECF4",
    border: "#2A2E3D",
    notification: "#C4555A",
  },
};

export default function AppNavigator() {
  const { user, isLoading } = useAuth0();
  const { profileStatus, setProfileStatus } = useProfileStatus(user);

  if (isLoading) {
    return null;
  }

  if (user && profileStatus === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0F1117", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4DA58E" />
      </View>
    );
  }

  return (
    <OnboardingContext.Provider value={{ onComplete: () => setProfileStatus("complete") }}>
      <NavigationContainer theme={MomentumTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            profileStatus === "needs_onboarding" ? (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            ) : (
              <>
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="WorkoutCalendar" component={WorkoutCalendarScreen} />
              </>
            )
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </OnboardingContext.Provider>
  );
}
