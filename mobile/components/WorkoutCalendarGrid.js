import { View, Text, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month, 1).getDay();
}

function toDateString(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function WorkoutCalendarGrid({
  viewingYear,
  viewingMonth,
  workoutsByDate,
  selectedDate,
  onSelectDate,
  onNavigateMonth,
}) {
  const today = getTodayDate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const canGoNext = viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth);

  const daysInMonth = getDaysInMonth(viewingYear, viewingMonth);
  const firstDay = getFirstDayOfWeek(viewingYear, viewingMonth);

  // Build grid cells
  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  while (cells.length < 42) {
    cells.push(null);
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View className="px-4 pt-4">
      {/* Month header */}
      <View className="flex-row items-center justify-between mb-4">
        <Pressable
          onPress={() => onNavigateMonth(-1)}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          className="p-2"
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color="#9BA3B5" />
        </Pressable>
        <Text className="text-base text-primary font-semibold">
          {MONTH_NAMES[viewingMonth]} {viewingYear}
        </Text>
        <Pressable
          onPress={() => onNavigateMonth(1)}
          disabled={!canGoNext}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className="p-2"
          style={{ opacity: canGoNext ? 1 : 0.3 }}
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color="#9BA3B5" />
        </Pressable>
      </View>

      {/* Day-of-week labels */}
      <View className="flex-row mb-2">
        {DAY_LABELS.map((label, i) => (
          <View key={i} className="flex-1 items-center">
            <Text className="text-xs text-muted font-medium">{label}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} className="flex-row" style={{ marginBottom: 4 }}>
          {row.map((day, colIndex) => {
            if (day === null) {
              return <View key={colIndex} className="flex-1 items-center" style={{ height: 42 }} />;
            }

            const dateStr = toDateString(viewingYear, viewingMonth, day);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isFuture = dateStr > today;
            const hasWorkout = !!workoutsByDate[dateStr];

            return (
              <View key={colIndex} className="flex-1 items-center" style={{ height: 42 }}>
                <Pressable
                  onPress={() => !isFuture && onSelectDate(dateStr)}
                  disabled={isFuture}
                  accessibilityRole="button"
                  accessibilityLabel={`${MONTH_NAMES[viewingMonth]} ${day}`}
                  testID={`calendar-day-${dateStr}`}
                  className="items-center justify-center rounded-full"
                  style={[
                    { width: 38, height: 38 },
                    hasWorkout && { backgroundColor: "#4DA58E" },
                    !hasWorkout && !isToday && { backgroundColor: "#1A1D27" },
                    isToday && !hasWorkout && { borderWidth: 2, borderColor: "#4DA58E" },
                    isToday && hasWorkout && { borderWidth: 2, borderColor: "#E8ECF4" },
                    isSelected && { borderWidth: 2, borderColor: "#E8ECF4" },
                    isFuture && { opacity: 0.3 },
                  ]}
                >
                  <Text
                    className={`text-sm font-medium ${
                      hasWorkout
                        ? "text-primary"
                        : isToday
                          ? "text-accent"
                          : isFuture
                            ? "text-muted"
                            : "text-secondary"
                    }`}
                  >
                    {day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
