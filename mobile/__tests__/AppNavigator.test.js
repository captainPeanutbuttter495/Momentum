import { render, screen } from "@testing-library/react-native";

const mockUseAuth0 = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => mockUseAuth0(),
  Auth0Provider: ({ children }) => children,
}));

import AppNavigator from "../app/navigation/AppNavigator";

describe("AppNavigator", () => {
  it("shows LoginScreen when user is null", () => {
    mockUseAuth0.mockReturnValue({ user: null, isLoading: false });
    render(<AppNavigator />);
    expect(screen.getByLabelText("Sign in with Google")).toBeOnTheScreen();
  });

  it("shows HomeScreen when user is authenticated", () => {
    mockUseAuth0.mockReturnValue({
      user: { name: "Test User", email: "test@gmail.com" },
      isLoading: false,
    });
    render(<AppNavigator />);
    expect(screen.getByText("Welcome, Test User")).toBeOnTheScreen();
  });

  it("shows nothing while loading", () => {
    mockUseAuth0.mockReturnValue({ user: null, isLoading: true });
    const { toJSON } = render(<AppNavigator />);
    expect(toJSON()).toBeNull();
  });
});
