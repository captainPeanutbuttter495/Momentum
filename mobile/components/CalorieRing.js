import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

const SIZE = 160;
const STROKE_WIDTH = 10;
const GLOW_WIDTH = 16;
const RADIUS = (SIZE - GLOW_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

const ACCENT = "#4DA58E";
const ACCENT_GLOW = "#4DA58E40";
const ERROR = "#C4555A";
const ERROR_GLOW = "#C4555A40";
const BG_STROKE = "#2A2E3D";

export default function CalorieRing({ consumed = 0, target = 2000 }) {
  const remaining = Math.max(target - consumed, 0);
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const isOver = consumed > target;
  const strokeDashoffset = CIRCUMFERENCE * (1 - pct);

  const ringColor = isOver ? ERROR : ACCENT;
  const glowColor = isOver ? ERROR_GLOW : ACCENT_GLOW;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* Background circle */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={BG_STROKE}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Glow circle (wider, transparent) */}
          {pct > 0 && (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke={glowColor}
              strokeWidth={GLOW_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          )}
          {/* Progress circle */}
          {pct > 0 && (
            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              stroke={ringColor}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
            />
          )}
        </Svg>
        {/* Center text */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-primary text-2xl font-bold">
            {isOver ? `+${consumed - target}` : remaining.toLocaleString()}
          </Text>
          <Text className="text-muted text-xs">
            {isOver ? "over" : "remaining"}
          </Text>
        </View>
      </View>
    </View>
  );
}
