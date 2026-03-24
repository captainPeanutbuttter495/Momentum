import { View, Text, TextInput, Pressable, Modal, ScrollView, ActivityIndicator, Switch } from "react-native";
import { useState, useEffect } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function WorkoutLogModal({
  visible,
  onClose,
  templates,
  onLogWorkout,
  onSaveTemplate,
  isSaving,
  workoutName,
  existingLog,
}) {
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState(null);

  // Pre-fill description from existing log when editing
  useEffect(() => {
    if (visible && existingLog?.description) {
      setDescription(existingLog.description);
    }
  }, [visible, existingLog]);

  const resetState = () => {
    setDescription("");
    setSelectedTemplate(null);
    setSaveAsTemplate(false);
    setTemplateName("");
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const selectTemplate = (template) => {
    setSelectedTemplate(template);
    setDescription(template.description || "");
    setSaveAsTemplate(false);
    setTemplateName("");
  };

  const clearTemplate = () => {
    setSelectedTemplate(null);
    setDescription("");
    setSaveAsTemplate(false);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!description.trim()) {
      setError("Describe your workout to log it");
      return;
    }

    try {
      // Save as template first if requested
      if (saveAsTemplate && templateName.trim()) {
        await onSaveTemplate({
          name: templateName.trim(),
          description: description.trim(),
        });
      }

      await onLogWorkout({
        description: description.trim(),
        fitbitWorkoutName: workoutName,
        templateId: selectedTemplate?.id || null,
      });

      handleClose();
    } catch (err) {
      setError("Failed to log workout. Please try again.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-14 pb-3 border-b border-border">
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="p-2"
          >
            <MaterialCommunityIcons name="close" size={24} color="#E8ECF4" />
          </Pressable>
          <View className="items-center">
            <Text className="text-lg font-semibold text-primary">Log Workout</Text>
            {workoutName && (
              <Text className="text-xs text-muted">{workoutName}</Text>
            )}
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save workout"
            className="p-2"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#4DA58E" />
            ) : (
              <Text className="text-sm font-semibold text-accent">Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {/* Template Selection */}
          {!selectedTemplate && templates.length > 0 && (
            <View className="mb-4">
              <Text className="text-xs text-secondary font-semibold uppercase tracking-wider mb-2">
                Saved Templates
              </Text>
              {templates.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => selectTemplate(t)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${t.name}`}
                  className="bg-surface rounded-xl p-4 mb-2 flex-row items-center"
                >
                  <MaterialCommunityIcons name="dumbbell" size={20} color="#4DA58E" />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-primary">{t.name}</Text>
                    <Text className="text-xs text-muted mt-0.5" numberOfLines={1}>
                      {t.description}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#5C6379" />
                </Pressable>
              ))}

              <View className="flex-row items-center my-3">
                <View className="flex-1 h-px bg-border" />
                <Text className="text-xs text-muted mx-3">or describe your workout</Text>
                <View className="flex-1 h-px bg-border" />
              </View>
            </View>
          )}

          {/* Selected template header */}
          {selectedTemplate && (
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="dumbbell" size={18} color="#4DA58E" />
                <Text className="text-sm font-semibold text-accent ml-2">
                  {selectedTemplate.name}
                </Text>
              </View>
              <Pressable
                onPress={clearTemplate}
                accessibilityRole="button"
                accessibilityLabel="Clear template"
                className="p-1"
              >
                <Text className="text-xs text-muted">Change</Text>
              </Pressable>
            </View>
          )}

          {/* Free-form workout description */}
          <View className="mb-4">
            <Text className="text-xs text-secondary font-semibold uppercase tracking-wider mb-2">
              Workout Description
            </Text>
            <View className="bg-surface rounded-xl border border-border p-3">
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={'e.g., Dumbbell chest press 30lbs 3x10, overhead press 30lbs 3x8, lateral raises 20lbs 3x10'}
                placeholderTextColor="#5C6379"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                testID="workout-description-input"
                className="text-primary text-sm"
                style={{ minHeight: 120 }}
              />
            </View>
            <Text className="text-xs text-muted mt-2">
              Write your exercises naturally — we'll parse the details automatically
            </Text>
          </View>

          {/* Save as Template option (only for custom workouts) */}
          {!selectedTemplate && (
            <View className="bg-surface rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-primary">Save as template</Text>
                <Switch
                  value={saveAsTemplate}
                  onValueChange={setSaveAsTemplate}
                  trackColor={{ false: "#2A2E3D", true: "#3A7D6B" }}
                  thumbColor={saveAsTemplate ? "#4DA58E" : "#5C6379"}
                  testID="save-template-switch"
                />
              </View>
              {saveAsTemplate && (
                <View className="mt-3 bg-surface-elevated border border-border rounded-lg px-3 py-2">
                  <TextInput
                    value={templateName}
                    onChangeText={setTemplateName}
                    placeholder="Template name (e.g., Dumbbell Day)"
                    placeholderTextColor="#5C6379"
                    testID="template-name-input"
                    className="text-primary text-sm"
                  />
                </View>
              )}
            </View>
          )}

          {/* Error message */}
          {error && (
            <View className="bg-surface rounded-xl p-3 mb-4 flex-row items-center">
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#C4555A" />
              <Text className="text-sm text-error ml-2">{error}</Text>
            </View>
          )}

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Log workout"
            className={`rounded-xl py-4 items-center mb-8 ${isSaving ? "bg-accent-muted" : "bg-accent"}`}
          >
            {isSaving ? (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#E8ECF4" />
                <Text className="text-base font-semibold text-primary ml-2">Parsing & saving...</Text>
              </View>
            ) : (
              <Text className="text-base font-semibold text-primary">
                {existingLog ? "Update Workout" : "Log Workout"}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
