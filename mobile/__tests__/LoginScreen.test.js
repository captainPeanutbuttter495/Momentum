import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockAuthorize = jest.fn();
const mockUseAuth0 = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => mockUseAuth0(),
  Auth0Provider: ({ children }) => children,
}));

import LoginScreen from "../app/screens/LoginScreen";

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth0.mockReturnValue({
      authorize: mockAuthorize,
      user: null,
      error: null,
      isLoading: false,
    });
  });

  it("renders the sign-in button", () => {
    render(<LoginScreen />);
    expect(screen.getByLabelText("Sign in with Google")).toBeOnTheScreen();
  });

  it("renders the app name", () => {
    render(<LoginScreen />);
    expect(screen.getByText("Momentum")).toBeOnTheScreen();
  });

  it("calls authorize with correct params when sign-in is pressed", async () => {
    mockAuthorize.mockResolvedValue({});
    render(<LoginScreen />);

    fireEvent.press(screen.getByLabelText("Sign in with Google"));

    await waitFor(() => {
      expect(mockAuthorize).toHaveBeenCalledWith(
        { scope: "openid profile email" },
        { customScheme: "momentum" }
      );
    });
  });

  it("displays error message when auth fails", () => {
    mockUseAuth0.mockReturnValue({
      authorize: mockAuthorize,
      user: null,
      error: { message: "User cancelled the login" },
      isLoading: false,
    });

    render(<LoginScreen />);
    expect(screen.getByText("User cancelled the login")).toBeOnTheScreen();
  });
});
