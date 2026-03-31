import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GradientBackground from "../../components/GradientBackground";
import WorkoutCalendarGrid from "../../components/WorkoutCalendarGrid";
import WorkoutDayDetail from "../../components/WorkoutDayDetail";
import useWorkoutCalendar from "../../hooks/useWorkoutCalendar";

function toMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export default function WorkoutCalendarScreen() {
  const navigation = useNavigation();
  const {
    workoutsByDate,
    isLoading,
    error,
    selectedDate,
    selectDate,
    viewingYear,
    viewingMonth,
    navigateMonth,
    refetch,
  } = useWorkoutCalendar();

  // Compute monthly stats for the viewing month
  const monthPrefix = toMonthKey(viewingYear, viewingMonth);
  const monthDates = Object.keys(workoutsByDate).filter((d) => d.startsWith(monthPrefix));
  const loggedDays = monthDates.length;
  const totalLogs = monthDates.reduce(
    (sum, d) => sum + (workoutsByDate[d]?.length || 0),
    0,
  );

  const selectedLogs = selectedDate ? workoutsByDate[selectedDate] || null : null;

  return (
    <GradientBackground>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-14 pb-3 border-b border-border">
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="p-2"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#E8ECF4" />
        </Pressable>
        <Text className="text-lg font-semibold text-primary ml-3">
          Workout Log Calendar
        </Text>
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4DA58E" />
          <Text className="text-sm text-secondary mt-3">Loading calendar...</Text>
        </View>
      )}

      {!isLoading && error && (
        <View className="bg-surface rounded-xl p-5 mx-4 mt-4 items-center">
          <MaterialCommunityIcons name="alert-circle-outline" size={28} color="#C4555A" />
          <Text className="text-sm text-secondary mt-2 text-center">{error}</Text>
          <Pressable
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Retry"
            className="bg-accent rounded-lg px-4 py-2 mt-3"
          >
            <Text className="text-sm font-semibold text-primary">Retry</Text>
          </Pressable>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <WorkoutCalendarGrid
            viewingYear={viewingYear}
            viewingMonth={viewingMonth}
            workoutsByDate={workoutsByDate}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            onNavigateMonth={navigateMonth}
          />

          {selectedDate && (
            <WorkoutDayDetail date={selectedDate} logs={selectedLogs} />
          )}

          {/* Monthly stats */}
          <View className="bg-surface rounded-xl p-4 mx-4 mt-4 mb-8">
            <Text className="text-accent text-xs font-semibold uppercase tracking-wide mb-3">
              This Month
            </Text>
            <View className="flex-row" style={{ gap: 16 }}>
              <View className="flex-1 items-center">
                <Text className="text-primary text-xl font-bold">{loggedDays}</Text>
                <Text className="text-secondary text-xs mt-1">Logged Days</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-primary text-xl font-bold">{totalLogs}</Text>
                <Text className="text-secondary text-xs mt-1">Workout Logs</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </GradientBackground>
  );
}
