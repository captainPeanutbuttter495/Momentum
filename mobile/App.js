import { StatusBar } from "expo-status-bar";
import AuthProvider from "./context/AuthContext";
import AppNavigator from "./app/navigation/AppNavigator";

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
