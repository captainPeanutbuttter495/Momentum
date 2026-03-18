import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockOnComplete = jest.fn();

jest.mock("../context/OnboardingContext", () => ({
  useOnboarding: () => ({ onComplete: mockOnComplete }),
  __esModule: true,
  default: {
    Provider: ({ children }) => children,
    Consumer: ({ children }) => children({ onComplete: mockOnComplete }),
  },
}));

import OnboardingScreen from "../app/screens/OnboardingScreen";

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders step 1 with goal selection", () => {
    render(<OnboardingScreen />);
    expect(screen.getByText("What's your goal?")).toBeOnTheScreen();
    expect(screen.getByTestId("goal-LOSE_WEIGHT")).toBeOnTheScreen();
    expect(screen.getByTestId("goal-MAINTAIN")).toBeOnTheScreen();
    expect(screen.getByTestId("goal-GAIN_MUSCLE")).toBeOnTheScreen();
  });

  it("shows Next button disabled until a goal is selected", () => {
    render(<OnboardingScreen />);
    const nextButton = screen.getByTestId("next-button");
    expect(nextButton).toBeOnTheScreen();
  });

  it("advances to step 2 after selecting a goal and pressing Next", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId("goal-LOSE_WEIGHT"));
    fireEvent.press(screen.getByTestId("next-button"));
    expect(screen.getByText("About you")).toBeOnTheScreen();
  });

  it("shows body info inputs on step 2", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId("goal-LOSE_WEIGHT"));
    fireEvent.press(screen.getByTestId("next-button"));

    expect(screen.getByTestId("input-age")).toBeOnTheScreen();
    expect(screen.getByTestId("input-height-feet")).toBeOnTheScreen();
    expect(screen.getByTestId("input-height-inches")).toBeOnTheScreen();
    expect(screen.getByTestId("input-weight")).toBeOnTheScreen();
    expect(screen.getByTestId("gender-MALE")).toBeOnTheScreen();
    expect(screen.getByTestId("gender-FEMALE")).toBeOnTheScreen();
  });

  it("navigates back from step 2 to step 1", () => {
    render(<OnboardingScreen />);
    fireEvent.press(screen.getByTestId("goal-LOSE_WEIGHT"));
    fireEvent.press(screen.getByTestId("next-button"));
    expect(screen.getByText("About you")).toBeOnTheScreen();

    fireEvent.press(screen.getByTestId("back-button"));
    expect(screen.getByText("What's your goal?")).toBeOnTheScreen();
  });

  it("advances through all steps to results for LOSE_WEIGHT", () => {
    render(<OnboardingScreen />);

    // Step 1: Goal
    fireEvent.press(screen.getByTestId("goal-LOSE_WEIGHT"));
    fireEvent.press(screen.getByTestId("next-button"));

    // Step 2: Body Info
    fireEvent.changeText(screen.getByTestId("input-age"), "26");
    fireEvent.changeText(screen.getByTestId("input-height-feet"), "5");
    fireEvent.changeText(screen.getByTestId("input-height-inches"), "10");
    fireEvent.changeText(screen.getByTestId("input-weight"), "266");
    fireEvent.press(screen.getByTestId("gender-MALE"));
    fireEvent.press(screen.getByTestId("next-button"));

    // Step 3: Activity Level
    expect(screen.getByText("Activity level")).toBeOnTheScreen();
    fireEvent.press(screen.getByTestId("activity-1.55"));
    fireEvent.press(screen.getByTestId("next-button"));

    // Step 4: Target Weight
    expect(screen.getByTestId("input-target-weight")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId("input-target-weight"), "220");
    fireEvent.press(screen.getByTestId("next-button"));

    // Step 5: Results
    expect(screen.getByText("Your plan")).toBeOnTheScreen();
    expect(screen.getByText(/BMR/)).toBeOnTheScreen();
    expect(screen.getByText(/Maintenance/)).toBeOnTheScreen();
  });

  it("shows rate selection cards on results step", () => {
    render(<OnboardingScreen />);

    // Navigate to step 5
    fireEvent.press(screen.getByTestId("goal-LOSE_WEIGHT"));
    fireEvent.press(screen.getByTestId("next-button"));
    fireEvent.changeText(screen.getByTestId("input-age"), "26");
    fireEvent.changeText(screen.getByTestId("input-height-feet"), "5");
    fireEvent.changeText(screen.getByTestId("input-height-inches"), "10");
    fireEvent.changeText(screen.getByTestId("input-weight"), "266");
    fireEvent.press(screen.getByTestId("gender-MALE"));
    fireEvent.press(screen.getByTestId("next-button"));
    fireEvent.press(screen.getByTestId("activity-1.55"));
    fireEvent.press(screen.getByTestId("next-button"));
    fireEvent.changeText(screen.getByTestId("input-target-weight"), "220");
    fireEvent.press(screen.getByTestId("next-button"));

    expect(screen.getByTestId("rate-0.5")).toBeOnTheScreen();
    expect(screen.getByTestId("rate-1")).toBeOnTheScreen();
    expect(screen.getByTestId("rate-1.5")).toBeOnTheScreen();
    expect(screen.getByTestId("rate-2")).toBeOnTheScreen();
  });

  it("skips step 4 for MAINTAIN goal", () => {
    render(<OnboardingScreen />);

    // Step 1: Maintain
    fireEvent.press(screen.getByTestId("goal-MAINTAIN"));
    fireEvent.press(screen.getByTestId("next-button"));

    // Step 2: Body Info
    fireEvent.changeText(screen.getByTestId("input-age"), "26");
    fireEvent.changeText(screen.getByTestId("input-height-feet"), "5");
    fireEvent.changeText(screen.getByTestId("input-height-inches"), "10");
    fireEvent.changeText(screen.getByTestId("input-weight"), "200");
    fireEvent.press(screen.getByTestId("gender-MALE"));
    fireEvent.press(screen.getByTestId("next-button"));

    // Step 3: Activity Level
    fireEvent.press(screen.getByTestId("activity-1.375"));
    fireEvent.press(screen.getByTestId("next-button"));

    // Should skip to step 5 (results), not step 4 (target weight)
    expect(screen.getByText("Your plan")).toBeOnTheScreen();
    expect(screen.queryByTestId("input-target-weight")).toBeNull();
  });

  it("does not show back button on step 1", () => {
    render(<OnboardingScreen />);
    expect(screen.queryByTestId("back-button")).toBeNull();
  });

  it("shows Get Started button on final step", () => {
    render(<OnboardingScreen />);

    fireEvent.press(screen.getByTestId("goal-LOSE_WEIGHT"));
    fireEvent.press(screen.getByTestId("next-button"));
    fireEvent.changeText(screen.getByTestId("input-age"), "26");
    fireEvent.changeText(screen.getByTestId("input-height-feet"), "5");
    fireEvent.changeText(screen.getByTestId("input-height-inches"), "10");
    fireEvent.changeText(screen.getByTestId("input-weight"), "266");
    fireEvent.press(screen.getByTestId("gender-MALE"));
    fireEvent.press(screen.getByTestId("next-button"));
    fireEvent.press(screen.getByTestId("activity-1.55"));
    fireEvent.press(screen.getByTestId("next-button"));
    fireEvent.changeText(screen.getByTestId("input-target-weight"), "220");
    fireEvent.press(screen.getByTestId("next-button"));

    expect(screen.getByTestId("get-started-button")).toBeOnTheScreen();
    expect(screen.getByText("Get Started")).toBeOnTheScreen();
  });
});
