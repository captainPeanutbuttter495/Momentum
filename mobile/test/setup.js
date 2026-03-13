import "@testing-library/jest-native/extend-expect";

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
