import { render, screen, fireEvent } from "@testing-library/react-native";

const mockGoBack = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

import ProfileScreen from "../app/screens/ProfileScreen";

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the placeholder text", () => {
    render(<ProfileScreen />);
    expect(
      screen.getByText("This is the profile page")
    ).toBeOnTheScreen();
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
});
