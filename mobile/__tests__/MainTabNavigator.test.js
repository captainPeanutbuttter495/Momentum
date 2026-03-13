import { render, screen } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";

const mockUseAuth0 = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => mockUseAuth0(),
  Auth0Provider: ({ children }) => children,
}));

import MainTabNavigator from "../app/navigation/MainTabNavigator";

describe("MainTabNavigator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth0.mockReturnValue({
      user: { name: "Test User", email: "test@gmail.com" },
    });
  });

  it("renders all three tab labels", () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );
    expect(screen.getByText("Nutrition")).toBeOnTheScreen();
    expect(screen.getByText("Home")).toBeOnTheScreen();
    expect(screen.getByText("Fitbit")).toBeOnTheScreen();
  });

  it("shows HomeScreen by default", () => {
    render(
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    );
    expect(screen.getByText("Welcome, Test User")).toBeOnTheScreen();
  });
});
