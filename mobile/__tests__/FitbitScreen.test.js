import { render, screen } from "@testing-library/react-native";
import FitbitScreen from "../app/screens/FitbitScreen";

describe("FitbitScreen", () => {
  it("renders the placeholder text", () => {
    render(<FitbitScreen />);
    expect(
      screen.getByText("This is the fitbit data page")
    ).toBeOnTheScreen();
  });
});
