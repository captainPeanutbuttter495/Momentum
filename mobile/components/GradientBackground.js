import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function GradientBackground({ children, style }) {
  return (
    <View className="flex-1" style={style}>
      <LinearGradient
        colors={["#0D0B14", "#1C1430", "#0D0B14"]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <LinearGradient
        colors={["transparent", "#4DA58E10", "transparent"]}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 1, y: 0.7 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}
