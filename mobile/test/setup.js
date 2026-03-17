import "@testing-library/jest-native/extend-expect";

jest.mock("react-native-auth0", () => ({
  useAuth0: () => ({
    user: { name: "Test User", email: "test@gmail.com" },
    authorize: jest.fn(),
    clearSession: jest.fn(),
    getCredentials: jest.fn().mockResolvedValue({ accessToken: "test-token" }),
  }),
  Auth0Provider: ({ children }) => children,
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }) => <View {...props}>{children}</View>,
  };
});

jest.mock("react-native-svg", () => {
  const { View } = require("react-native");
  const mock = (name) => {
    const C = ({ children, ...props }) => <View {...props}>{children}</View>;
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: mock("Svg"),
    Svg: mock("Svg"),
    Circle: mock("Circle"),
    Defs: mock("Defs"),
    Stop: mock("Stop"),
    RadialGradient: mock("RadialGradient"),
    G: mock("G"),
  };
});

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  const mockIcon = (name) => {
    const Icon = (props) => <Text {...props}>{props.name}</Text>;
    Icon.displayName = name;
    return Icon;
  };
  return {
    MaterialCommunityIcons: mockIcon("MaterialCommunityIcons"),
  };
});
