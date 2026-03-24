import { View, Text, Pressable, Modal } from "react-native";
import { useState, useEffect } from "react";
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

function formatMonthYear(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
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

export default function CalendarPicker({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
  maxDate,
}) {
  const effectiveMax = maxDate || getTodayDate();

  const [viewingYear, setViewingYear] = useState(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.getFullYear();
  });
  const [viewingMonth, setViewingMonth] = useState(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.getMonth();
  });

  useEffect(() => {
    if (visible && selectedDate) {
      const d = new Date(selectedDate + "T00:00:00");
      setViewingYear(d.getFullYear());
      setViewingMonth(d.getMonth());
    }
  }, [visible, selectedDate]);

  const today = getTodayDate();
  const maxYear = parseInt(effectiveMax.slice(0, 4), 10);
  const maxMonth = parseInt(effectiveMax.slice(5, 7), 10) - 1;

  const canGoNext = viewingYear < maxYear || (viewingYear === maxYear && viewingMonth < maxMonth);

  const goToPreviousMonth = () => {
    if (viewingMonth === 0) {
      setViewingMonth(11);
      setViewingYear(viewingYear - 1);
    } else {
      setViewingMonth(viewingMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (!canGoNext) return;
    if (viewingMonth === 11) {
      setViewingMonth(0);
      setViewingYear(viewingYear + 1);
    } else {
      setViewingMonth(viewingMonth + 1);
    }
  };

  const handleDayPress = (day) => {
    const dateStr = toDateString(viewingYear, viewingMonth, day);
    if (dateStr > effectiveMax) return;
    onSelectDate(dateStr);
    onClose();
  };

  const daysInMonth = getDaysInMonth(viewingYear, viewingMonth);
  const firstDay = getFirstDayOfWeek(viewingYear, viewingMonth);

  // Build grid: leading empties + day numbers + trailing empties to fill 6 rows
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1 }}
        className="justify-center items-center"
        accessibilityRole="button"
        accessibilityLabel="Close calendar"
      >
        <View className="absolute inset-0 bg-black/50" />
        <Pressable
          onPress={(e) => e?.stopPropagation()}
          className="bg-surface-elevated rounded-2xl p-4 mx-6"
          style={{ width: 340 }}
        >
          {/* Month header */}
          <View className="flex-row items-center justify-between mb-3">
            <Pressable
              onPress={goToPreviousMonth}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              className="p-2"
            >
              <MaterialCommunityIcons name="chevron-left" size={24} color="#9BA3B5" />
            </Pressable>
            <Text className="text-base text-primary font-semibold">
              {formatMonthYear(viewingYear, viewingMonth)}
            </Text>
            <Pressable
              onPress={goToNextMonth}
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
          <View className="flex-row mb-1">
            {DAY_LABELS.map((label, i) => (
              <View key={i} style={{ width: 40, height: 28 }} className="items-center justify-center mx-auto">
                <Text className="text-xs text-muted font-medium">{label}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row">
              {row.map((day, colIndex) => {
                if (day === null) {
                  return <View key={colIndex} style={{ width: 40, height: 40 }} className="mx-auto" />;
                }

                const dateStr = toDateString(viewingYear, viewingMonth, day);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === today;
                const isFuture = dateStr > effectiveMax;

                return (
                  <Pressable
                    key={colIndex}
                    onPress={() => handleDayPress(day)}
                    disabled={isFuture}
                    accessibilityRole="button"
                    accessibilityLabel={`${day}`}
                    style={{ width: 40, height: 40 }}
                    className={`items-center justify-center mx-auto rounded-full ${
                      isSelected
                        ? "bg-accent"
                        : isToday
                          ? "border border-accent"
                          : ""
                    }`}
                  >
                    <Text
                      className={`text-sm ${
                        isFuture
                          ? "text-muted opacity-30"
                          : isSelected
                            ? "text-primary font-bold"
                            : isToday
                              ? "text-accent font-medium"
                              : "text-primary"
                      }`}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
