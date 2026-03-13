import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle } from "react-native-svg";

const SIZE = 24;
const CENTER = SIZE / 2;
const RADIUS = 9;
const STROKE_WIDTH = 2.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DASH_ARRAY = `${Math.round(CIRCUMFERENCE * 0.7)} ${Math.round(CIRCUMFERENCE * 0.3)}`;

export default function LoadingRing() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();
    return () => spin.stop();
  }, []);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="#E8ECF4"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={DASH_ARRAY}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
