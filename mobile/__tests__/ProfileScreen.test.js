import { render, screen, fireEvent, act } from "@testing-library/react-native";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

import ProfileScreen from "../app/screens/ProfileScreen";

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays Profile in the header", () => {
    render(<ProfileScreen />);
    expect(screen.getByText("Profile")).toBeOnTheScreen();
  });

  it("navigates back when back button is pressed", () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText("Go back"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("shows loading indicator initially", () => {
    const { toJSON } = render(<ProfileScreen />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("ActivityIndicator");
  });

  it("shows save button after loading completes", async () => {
    render(<ProfileScreen />);
    const saveButton = await screen.findByTestId("save-profile-button");
    expect(saveButton).toBeOnTheScreen();
  });

  it("renders goal selection cards after loading", async () => {
    render(<ProfileScreen />);
    const loseWeight = await screen.findByTestId("profile-goal-LOSE_WEIGHT");
    expect(loseWeight).toBeOnTheScreen();
    expect(screen.getByTestId("profile-goal-MAINTAIN")).toBeOnTheScreen();
    expect(screen.getByTestId("profile-goal-GAIN_MUSCLE")).toBeOnTheScreen();
  });
});
