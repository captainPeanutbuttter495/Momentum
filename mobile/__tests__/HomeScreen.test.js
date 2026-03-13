import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockClearSession = jest.fn();
const mockUseAuth0 = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => mockUseAuth0(),
  Auth0Provider: ({ children }) => children,
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

  it("displays the user's email", () => {
    render(<HomeScreen />);
    expect(screen.getByText("test@gmail.com")).toBeOnTheScreen();
  });

  it("calls clearSession when log out is pressed", async () => {
    mockClearSession.mockResolvedValue(undefined);
    render(<HomeScreen />);

    fireEvent.press(screen.getByLabelText("Log out"));

    await waitFor(() => {
      expect(mockClearSession).toHaveBeenCalledWith(
        {},
        { customScheme: "momentum" }
      );
    });
  });
});
