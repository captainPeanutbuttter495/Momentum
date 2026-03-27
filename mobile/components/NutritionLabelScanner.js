import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function NutritionLabelScanner({ onScanComplete, isScanning }) {
  const [scanning, setScanning] = useState(false);

  const pickImage = async (useCamera) => {
    try {
      const options = {
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
      };

      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Camera access is required to scan nutrition labels.");
          return;
        }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const mediaType = asset.mimeType || "image/jpeg";
        setScanning(true);
        try {
          await onScanComplete(asset.base64, mediaType);
        } finally {
          setScanning(false);
        }
      }
    } catch (err) {
      setScanning(false);
      Alert.alert("Error", "Failed to process the image. Please try again.");
      console.error("Image picker error:", err);
    }
  };

  const handlePress = () => {
    Alert.alert("Scan Nutrition Label", "Choose a source", [
      { text: "Take Photo", onPress: () => pickImage(true) },
      { text: "Choose from Library", onPress: () => pickImage(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const loading = scanning || isScanning;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      className="bg-surface-elevated"
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
        borderRadius: 8,
        gap: 8,
      }}
    >
      {loading ? (
        <>
          <ActivityIndicator color="#4DA58E" size="small" />
          <Text style={{ fontSize: 13, color: "#4DA58E", fontWeight: "500" }}>
            Analyzing label...
          </Text>
        </>
      ) : (
        <>
          <MaterialCommunityIcons name="camera" size={18} color="#4DA58E" />
          <Text style={{ fontSize: 13, color: "#4DA58E", fontWeight: "500" }}>
            Scan Nutrition Label
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
