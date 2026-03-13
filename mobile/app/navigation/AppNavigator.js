import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth0 } from "react-native-auth0";

import LoginScreen from "../screens/LoginScreen";
import HomeScreen from "../screens/HomeScreen";

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

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer theme={MomentumTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Home" component={HomeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
