import { render, screen } from "@testing-library/react-native";
import NutritionScreen from "../app/screens/NutritionScreen";

describe("NutritionScreen", () => {
  it("renders the placeholder text", () => {
    render(<NutritionScreen />);
    expect(
      screen.getByText("This is the nutrition page")
    ).toBeOnTheScreen();
  });
});
