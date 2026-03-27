import { render, screen } from "@testing-library/react-native";

const mockUseNutrition = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => ({
    getCredentials: jest.fn().mockResolvedValue({ accessToken: "test-token" }),
  }),
  Auth0Provider: ({ children }) => children,
}));

jest.mock("../hooks/useNutrition", () => ({
  __esModule: true,
  default: () => mockUseNutrition(),
}));

jest.mock("expo-image-picker", () => ({
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: "granted" }),
}));

import NutritionScreen from "../app/screens/NutritionScreen";

describe("NutritionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading indicator while data is loading", () => {
    mockUseNutrition.mockReturnValue({
      summary: null,
      foodLog: [],
      isLoading: true,
      isSaving: false,
      error: null,
      addFoodEntry: jest.fn(),
      removeEntry: jest.fn(),
      searchFoods: jest.fn(),
      createCustomFood: jest.fn(),
      scanLabel: jest.fn(),
      refetch: jest.fn(),
    });

    render(<NutritionScreen />);
    expect(screen.getByTestId("activity-indicator")).toBeDefined();
  });

  it("shows empty state when no profile/summary exists", () => {
    mockUseNutrition.mockReturnValue({
      summary: null,
      foodLog: [],
      isLoading: false,
      isSaving: false,
      error: null,
      addFoodEntry: jest.fn(),
      removeEntry: jest.fn(),
      searchFoods: jest.fn(),
      createCustomFood: jest.fn(),
      scanLabel: jest.fn(),
      refetch: jest.fn(),
    });

    render(<NutritionScreen />);
    expect(
      screen.getByText("Set up your profile to start tracking nutrition"),
    ).toBeOnTheScreen();
  });

  it("renders Nutrition header and meal sections when summary exists", () => {
    mockUseNutrition.mockReturnValue({
      summary: {
        date: "2026-03-25",
        consumed: { calories: 500, proteinG: 40, carbsG: 60, fatG: 20 },
        targets: { calories: 2000, proteinG: 162, carbsG: 200, fatG: 54 },
        logs: [],
      },
      foodLog: [],
      isLoading: false,
      isSaving: false,
      error: null,
      addFoodEntry: jest.fn(),
      removeEntry: jest.fn(),
      searchFoods: jest.fn(),
      createCustomFood: jest.fn(),
      scanLabel: jest.fn(),
      refetch: jest.fn(),
    });

    render(<NutritionScreen />);
    expect(screen.getByText("Nutrition")).toBeOnTheScreen();
    expect(screen.getByText("Breakfast")).toBeOnTheScreen();
    expect(screen.getByText("Lunch")).toBeOnTheScreen();
    expect(screen.getByText("Dinner")).toBeOnTheScreen();
    expect(screen.getByText("Snack")).toBeOnTheScreen();
  });

  it("displays remaining calories in the ring", () => {
    mockUseNutrition.mockReturnValue({
      summary: {
        date: "2026-03-25",
        consumed: { calories: 500, proteinG: 40, carbsG: 60, fatG: 20 },
        targets: { calories: 2000, proteinG: 162, carbsG: 200, fatG: 54 },
        logs: [],
      },
      foodLog: [],
      isLoading: false,
      isSaving: false,
      error: null,
      addFoodEntry: jest.fn(),
      removeEntry: jest.fn(),
      searchFoods: jest.fn(),
      createCustomFood: jest.fn(),
      scanLabel: jest.fn(),
      refetch: jest.fn(),
    });

    render(<NutritionScreen />);
    // 2000 - 500 = 1500 remaining
    expect(screen.getByText("1,500")).toBeOnTheScreen();
    expect(screen.getByText("remaining")).toBeOnTheScreen();
  });

  it("displays food log entries in the correct meal section", () => {
    const mockLog = [
      {
        id: "fl-1",
        mealCategory: "BREAKFAST",
        foodName: "Egg, whole, raw",
        servingQty: 2,
        servingSize: 50,
        servingUnit: "1 egg",
        calories: 144,
      },
    ];

    mockUseNutrition.mockReturnValue({
      summary: {
        date: "2026-03-25",
        consumed: { calories: 144, proteinG: 12.6, carbsG: 0.8, fatG: 9.6 },
        targets: { calories: 2000, proteinG: 162, carbsG: 200, fatG: 54 },
        logs: mockLog,
      },
      foodLog: mockLog,
      isLoading: false,
      isSaving: false,
      error: null,
      addFoodEntry: jest.fn(),
      removeEntry: jest.fn(),
      searchFoods: jest.fn(),
      createCustomFood: jest.fn(),
      scanLabel: jest.fn(),
      refetch: jest.fn(),
    });

    render(<NutritionScreen />);
    expect(screen.getByText("Egg, whole, raw")).toBeOnTheScreen();
    // "144 cal" appears in both the meal section header and the log entry
    expect(screen.getAllByText("144 cal").length).toBeGreaterThanOrEqual(1);
  });
});
