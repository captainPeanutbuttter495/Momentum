import { render, screen, fireEvent } from "@testing-library/react-native";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const mockUseWorkoutCalendar = jest.fn();
jest.mock("../hooks/useWorkoutCalendar", () => ({
  __esModule: true,
  default: () => mockUseWorkoutCalendar(),
}));

import WorkoutCalendarScreen from "../app/screens/WorkoutCalendarScreen";

const mockWorkoutsByDate = {
  "2026-03-22": [
    {
      id: "log-1",
      date: "2026-03-22",
      fitbitWorkoutName: "Weights",
      description: "Chest press 3x10 30lbs",
      exercises: [
        { name: "Chest Press", weightLbs: 30, sets: 3, reps: 10, position: 0 },
        { name: "Bicep Curls", weightLbs: 25, sets: 3, reps: 12, position: 1 },
      ],
    },
  ],
  "2026-03-20": [
    {
      id: "log-2",
      date: "2026-03-20",
      fitbitWorkoutName: "Weights",
      description: "Squats 3x10 135lbs",
      exercises: [
        { name: "Squats", weightLbs: 135, sets: 3, reps: 10, position: 0 },
      ],
    },
  ],
};

function setupHook(overrides = {}) {
  mockUseWorkoutCalendar.mockReturnValue({
    workoutsByDate: mockWorkoutsByDate,
    isLoading: false,
    error: null,
    selectedDate: "2026-03-22",
    selectDate: jest.fn(),
    viewingYear: 2026,
    viewingMonth: 2, // March (0-indexed)
    navigateMonth: jest.fn(),
    refetch: jest.fn(),
    ...overrides,
  });
}

describe("WorkoutCalendarScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders header with title and back arrow", () => {
    setupHook();
    render(<WorkoutCalendarScreen />);
    expect(screen.getByText("Workout Log Calendar")).toBeOnTheScreen();
    expect(screen.getByLabelText("Go back")).toBeOnTheScreen();
  });

  it("navigates back when back arrow is pressed", () => {
    setupHook();
    render(<WorkoutCalendarScreen />);
    fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("shows loading indicator when loading", () => {
    setupHook({ isLoading: true });
    render(<WorkoutCalendarScreen />);
    expect(screen.getByText("Loading calendar...")).toBeOnTheScreen();
  });

  it("shows error state with retry button", () => {
    const mockRefetch = jest.fn();
    setupHook({ error: "Failed to load workout history", refetch: mockRefetch });
    render(<WorkoutCalendarScreen />);
    expect(screen.getByText("Failed to load workout history")).toBeOnTheScreen();
    expect(screen.getByLabelText("Retry")).toBeOnTheScreen();
  });

  it("calls refetch when retry is pressed", () => {
    const mockRefetch = jest.fn();
    setupHook({ error: "Failed to load workout history", refetch: mockRefetch });
    render(<WorkoutCalendarScreen />);
    fireEvent.press(screen.getByLabelText("Retry"));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders calendar grid with month and year", () => {
    setupHook();
    render(<WorkoutCalendarScreen />);
    expect(screen.getByText("March 2026")).toBeOnTheScreen();
  });

  it("renders day-of-week labels", () => {
    setupHook();
    render(<WorkoutCalendarScreen />);
    // Day labels appear multiple times (S twice for Sun/Sat, T twice for Tue/Thu)
    // Just verify the unique ones exist at least once
    expect(screen.getAllByText("S").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("M").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("W").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("F").length).toBeGreaterThanOrEqual(1);
  });

  it("renders month navigation arrows", () => {
    setupHook();
    render(<WorkoutCalendarScreen />);
    expect(screen.getByLabelText("Previous month")).toBeOnTheScreen();
    expect(screen.getByLabelText("Next month")).toBeOnTheScreen();
  });

  it("calls navigateMonth when arrows are pressed", () => {
    const mockNavigateMonth = jest.fn();
    setupHook({ navigateMonth: mockNavigateMonth });
    render(<WorkoutCalendarScreen />);
    fireEvent.press(screen.getByLabelText("Previous month"));
    expect(mockNavigateMonth).toHaveBeenCalledWith(-1);
  });

  it("shows workout day detail when a date with logs is selected", () => {
    setupHook({ selectedDate: "2026-03-22" });
    render(<WorkoutCalendarScreen />);
    expect(screen.getByTestId("workout-day-detail")).toBeOnTheScreen();
    expect(screen.getByText("Weights")).toBeOnTheScreen();
    expect(screen.getByText(/Chest Press/)).toBeOnTheScreen();
    expect(screen.getByText(/Bicep Curls/)).toBeOnTheScreen();
  });

  it("shows empty state when a date without logs is selected", () => {
    setupHook({ selectedDate: "2026-03-15", workoutsByDate: {} });
    render(<WorkoutCalendarScreen />);
    expect(screen.getByText("No workout logged")).toBeOnTheScreen();
  });

  it("shows monthly stats card with logged days and workout logs", () => {
    setupHook();
    render(<WorkoutCalendarScreen />);
    expect(screen.getByText("This Month")).toBeOnTheScreen();
    expect(screen.getByText("Logged Days")).toBeOnTheScreen();
    expect(screen.getByText("Workout Logs")).toBeOnTheScreen();
  });

  it("does not show detail card when no date is selected", () => {
    setupHook({ selectedDate: null });
    render(<WorkoutCalendarScreen />);
    expect(screen.queryByTestId("workout-day-detail")).toBeNull();
    expect(screen.queryByText("No workout logged")).toBeNull();
  });
});
