import { render, screen, fireEvent } from "@testing-library/react-native";
import CalendarPicker from "../components/CalendarPicker";

describe("CalendarPicker", () => {
  const defaultProps = {
    visible: true,
    selectedDate: "2026-03-16",
    onSelectDate: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────

  it("renders month and year header when visible", () => {
    render(<CalendarPicker {...defaultProps} />);

    expect(screen.getByText("March 2026")).toBeOnTheScreen();
  });

  it("renders day-of-week labels", () => {
    render(<CalendarPicker {...defaultProps} />);

    // S appears twice (Sunday, Saturday), others once
    expect(screen.getAllByText("S").length).toBe(2);
    expect(screen.getByText("M")).toBeOnTheScreen();
    expect(screen.getByText("W")).toBeOnTheScreen();
    expect(screen.getByText("F")).toBeOnTheScreen();
  });

  it("renders correct number of days for March", () => {
    render(<CalendarPicker {...defaultProps} />);

    expect(screen.getByLabelText("1")).toBeOnTheScreen();
    expect(screen.getByLabelText("31")).toBeOnTheScreen();
  });

  it("renders correct number of days for February in non-leap year", () => {
    render(
      <CalendarPicker {...defaultProps} selectedDate="2025-02-10" maxDate="2026-12-31" />,
    );

    expect(screen.getByText("February 2025")).toBeOnTheScreen();
    expect(screen.getByLabelText("28")).toBeOnTheScreen();
    expect(screen.queryByLabelText("29")).toBeNull();
  });

  // ── Day Selection ──────────────────────────────────────────────

  it("calls onSelectDate and onClose when a day is tapped", () => {
    render(<CalendarPicker {...defaultProps} />);

    fireEvent.press(screen.getByLabelText("10"));

    expect(defaultProps.onSelectDate).toHaveBeenCalledWith("2026-03-10");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not call onSelectDate for future dates", () => {
    render(<CalendarPicker {...defaultProps} maxDate="2026-03-16" />);

    // Day 17 is after maxDate — button should be disabled
    const day17 = screen.getByLabelText("17");
    fireEvent.press(day17);

    expect(defaultProps.onSelectDate).not.toHaveBeenCalled();
  });

  // ── Backdrop Dismiss ───────────────────────────────────────────

  it("calls onClose when backdrop is tapped", () => {
    render(<CalendarPicker {...defaultProps} />);

    fireEvent.press(screen.getByLabelText("Close calendar"));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  // ── Month Navigation ──────────────────────────────────────────

  it("navigates to previous month", () => {
    render(<CalendarPicker {...defaultProps} />);

    fireEvent.press(screen.getByLabelText("Previous month"));

    expect(screen.getByText("February 2026")).toBeOnTheScreen();
  });

  it("navigates to next month when allowed", () => {
    render(
      <CalendarPicker {...defaultProps} selectedDate="2026-02-10" maxDate="2026-03-31" />,
    );

    expect(screen.getByText("February 2026")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Next month"));

    expect(screen.getByText("March 2026")).toBeOnTheScreen();
  });

  it("disables next month chevron when viewing current max month", () => {
    render(<CalendarPicker {...defaultProps} maxDate="2026-03-22" />);

    // Already on March 2026, maxDate is in March — next should be disabled
    fireEvent.press(screen.getByLabelText("Next month"));

    // Should still show March (didn't navigate)
    expect(screen.getByText("March 2026")).toBeOnTheScreen();
  });

  it("wraps year when navigating past January", () => {
    render(
      <CalendarPicker {...defaultProps} selectedDate="2026-01-15" maxDate="2026-12-31" />,
    );

    expect(screen.getByText("January 2026")).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Previous month"));

    expect(screen.getByText("December 2025")).toBeOnTheScreen();
  });

  // ── Opens to Selected Date's Month ─────────────────────────────

  it("opens to the month containing the selected date", () => {
    render(
      <CalendarPicker {...defaultProps} selectedDate="2026-07-04" maxDate="2026-12-31" />,
    );

    expect(screen.getByText("July 2026")).toBeOnTheScreen();
  });
});
