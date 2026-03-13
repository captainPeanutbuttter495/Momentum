import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockClearSession = jest.fn();
const mockUseAuth0 = jest.fn();
const mockNavigate = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => mockUseAuth0(),
  Auth0Provider: ({ children }) => children,
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import HomeScreen from "../app/screens/HomeScreen";

describe("HomeScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth0.mockReturnValue({
      user: { name: "Test User", email: "test@gmail.com" },
      clearSession: mockClearSession,
    });
  });

  it("displays the user's name", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Welcome, Test User")).toBeOnTheScreen();
  });

  it("displays fallback greeting when name is missing", () => {
    mockUseAuth0.mockReturnValue({
      user: { email: "test@gmail.com" },
      clearSession: mockClearSession,
    });
    render(<HomeScreen />);
    expect(screen.getByText("Welcome, User")).toBeOnTheScreen();
  });

  it("displays Momentum in the header", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Momentum")).toBeOnTheScreen();
  });

  it("shows the hamburger menu button", () => {
    render(<HomeScreen />);
    expect(screen.getByLabelText("Open menu")).toBeOnTheScreen();
  });

  it("opens menu with Profile and Log Out options", () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    expect(screen.getByLabelText("Profile")).toBeOnTheScreen();
    expect(screen.getByLabelText("Log out")).toBeOnTheScreen();
  });

  it("navigates to Profile when Profile is pressed", () => {
    render(<HomeScreen />);
    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Profile"));
    expect(mockNavigate).toHaveBeenCalledWith("Profile");
  });

  it("calls clearSession when Log Out is pressed", async () => {
    mockClearSession.mockResolvedValue(undefined);
    render(<HomeScreen />);

    fireEvent.press(screen.getByLabelText("Open menu"));
    fireEvent.press(screen.getByLabelText("Log out"));

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalledWith(
        {},
        { customScheme: "momentum" }
      );
    });
  });
});
