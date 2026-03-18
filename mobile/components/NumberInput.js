import { View, Text, TextInput } from "react-native";

export default function NumberInput({ label, value, onChangeText, placeholder, suffix, testID }) {
  return (
    <View>
      {label && <Text className="text-secondary text-sm mb-1">{label}</Text>}
      <View
        className="bg-surface border border-border rounded-xl px-4 py-3"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#5C6379"
          keyboardType="numeric"
          testID={testID}
          className="text-primary text-base"
          style={{ flex: 1 }}
        />
        {suffix && <Text className="text-muted text-sm ml-2">{suffix}</Text>}
      </View>
    </View>
  );
}
