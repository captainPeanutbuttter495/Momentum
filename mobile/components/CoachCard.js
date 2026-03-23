import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

function BulletList({ items, color }) {
  if (!items || items.length === 0) return null;
  return items.map((item, i) => (
    <View key={i} className="flex-row items-start mt-1.5">
      <Text className="text-xs mt-0.5 mr-2" style={{ color }}>
        {"\u2022"}
      </Text>
      <Text className="text-sm text-primary flex-1 leading-5">{item}</Text>
    </View>
  ));
}

export default function CoachCard({ insights, onRecap, isRecapLoading }) {
  const { headline, keySignals, focus, context } = insights;

  return (
    <View className="bg-surface rounded-xl p-5 mx-6 mt-4">
      {/* Header label */}
      <View className="flex-row items-center mb-2">
        <MaterialCommunityIcons name="robot-outline" size={16} color="#4DA58E" />
        <Text className="text-xs text-accent ml-2 font-semibold uppercase tracking-wider">
          {context === "morning" ? "Morning Briefing" : "Day Recap"}
        </Text>
      </View>

      {/* Headline */}
      {headline ? (
        <Text className="text-lg font-bold text-primary mb-3">{headline}</Text>
      ) : null}

      {/* Key Signals */}
      {keySignals && keySignals.length > 0 && (
        <View className="mb-3">
          <Text className="text-xs text-secondary font-semibold uppercase tracking-wider mb-1">
            Key Signals
          </Text>
          <BulletList items={keySignals} color="#9BA3B5" />
        </View>
      )}

      {/* Today's Focus */}
      {focus && focus.length > 0 && (
        <View>
          <Text className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">
            {context === "morning" ? "Today's Focus" : "Takeaway"}
          </Text>
          <BulletList items={focus} color="#4DA58E" />
        </View>
      )}

      {/* Recap button — only in morning context */}
      {context === "morning" && (
        <Pressable
          onPress={onRecap}
          disabled={isRecapLoading}
          accessibilityRole="button"
          accessibilityLabel="Get day recap"
          className="bg-surface-elevated rounded-lg px-4 py-3 mt-4 flex-row items-center justify-center"
        >
          {isRecapLoading ? (
            <ActivityIndicator size="small" color="#4DA58E" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="clipboard-check-outline"
                size={18}
                color="#4DA58E"
              />
              <Text className="text-sm font-semibold text-accent ml-2">
                How did my day go?
              </Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
