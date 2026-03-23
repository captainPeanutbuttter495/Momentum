import { render, screen, fireEvent } from "@testing-library/react-native";
import CoachCard from "../components/CoachCard";

const morningInsight = {
  headline: "Good recovery — stay active",
  keySignals: ["~7h sleep, good quality", "Resting HR normal"],
  focus: ["Keep activity steady", "Stay consistent with movement"],
  context: "morning",
  date: "2026-03-22",
};

const recapInsight = {
  headline: "Solid day for your goal",
  keySignals: ["8k steps, strong activity", "Good HR zone time"],
  focus: ["Rest well tonight"],
  context: "recap",
  date: "2026-03-22",
};

describe("CoachCard", () => {
  it("renders morning briefing header", () => {
    render(<CoachCard insights={morningInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("Morning Briefing")).toBeOnTheScreen();
  });

  it("renders day recap header", () => {
    render(<CoachCard insights={recapInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("Day Recap")).toBeOnTheScreen();
  });

  it("renders headline text", () => {
    render(<CoachCard insights={morningInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("Good recovery — stay active")).toBeOnTheScreen();
  });

  it("renders key signals", () => {
    render(<CoachCard insights={morningInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("~7h sleep, good quality")).toBeOnTheScreen();
    expect(screen.getByText("Resting HR normal")).toBeOnTheScreen();
  });

  it("renders focus items", () => {
    render(<CoachCard insights={morningInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("Keep activity steady")).toBeOnTheScreen();
    expect(screen.getByText("Stay consistent with movement")).toBeOnTheScreen();
  });

  it("shows recap button in morning context", () => {
    render(<CoachCard insights={morningInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByLabelText("Get day recap")).toBeOnTheScreen();
  });

  it("hides recap button in recap context", () => {
    render(<CoachCard insights={recapInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.queryByLabelText("Get day recap")).toBeNull();
  });

  it("calls onRecap when button is pressed", () => {
    const onRecap = jest.fn();
    render(<CoachCard insights={morningInsight} onRecap={onRecap} isRecapLoading={false} />);
    fireEvent.press(screen.getByLabelText("Get day recap"));
    expect(onRecap).toHaveBeenCalledTimes(1);
  });

  it("renders Today's Focus label in morning context", () => {
    render(<CoachCard insights={morningInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("Today's Focus")).toBeOnTheScreen();
  });

  it("renders Takeaway label in recap context", () => {
    render(<CoachCard insights={recapInsight} onRecap={jest.fn()} isRecapLoading={false} />);
    expect(screen.getByText("Takeaway")).toBeOnTheScreen();
  });
});
