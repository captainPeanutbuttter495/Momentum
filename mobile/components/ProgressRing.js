import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import Svg, { Circle } from "react-native-svg";

const SIZE = 80;
const CENTER = SIZE / 2;
const RADIUS = 36;
const STROKE_WIDTH = 3;
const GLOW_STROKE_WIDTH = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~226.19
const DASH_ARRAY = `${Math.round(CIRCUMFERENCE * 0.85)} ${Math.round(CIRCUMFERENCE * 0.15)}`;

export default function ProgressRing() {
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spin.start();

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();

    return () => {
      spin.stop();
      breathe.stop();
    };
  }, []);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }, { scale: pulse }] }}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="#4DA58E40"
          strokeWidth={GLOW_STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="#4DA58E"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={DASH_ARRAY}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}
