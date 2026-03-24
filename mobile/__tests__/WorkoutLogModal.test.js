import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import WorkoutLogModal from "../components/WorkoutLogModal";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

const templates = [
  {
    id: "t1",
    name: "Push Day",
    description: "Bench press 3x10, overhead press 3x8, lateral raises 3x12",
    exercises: [],
  },
  {
    id: "t2",
    name: "Pull Day",
    description: "Barbell rows 3x10, bicep curls 3x12",
    exercises: [],
  },
];

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  templates: [],
  onLogWorkout: jest.fn().mockResolvedValue(undefined),
  onSaveTemplate: jest.fn().mockResolvedValue(undefined),
  isSaving: false,
  workoutName: "Weights",
  existingLog: null,
};

describe("WorkoutLogModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the modal with header showing Log Workout and workoutName subtitle", () => {
    render(<WorkoutLogModal {...defaultProps} />);
    expect(screen.getAllByText("Log Workout").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Weights")).toBeOnTheScreen();
  });

  it("shows saved templates list when templates are provided", () => {
    render(<WorkoutLogModal {...defaultProps} templates={templates} />);
    expect(screen.getByText("Saved Templates")).toBeOnTheScreen();
    expect(screen.getByText("Push Day")).toBeOnTheScreen();
    expect(screen.getByText("Pull Day")).toBeOnTheScreen();
  });

  it("selecting a template pre-fills the description text area", () => {
    render(<WorkoutLogModal {...defaultProps} templates={templates} />);
    fireEvent.press(screen.getByLabelText("Select Push Day"));
    const input = screen.getByTestId("workout-description-input");
    expect(input.props.value).toBe("Bench press 3x10, overhead press 3x8, lateral raises 3x12");
  });

  it("shows Change button when template selected, clicking it clears selection", () => {
    render(<WorkoutLogModal {...defaultProps} templates={templates} />);
    fireEvent.press(screen.getByLabelText("Select Push Day"));
    expect(screen.getByText("Change")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Clear template"));
    expect(screen.queryByText("Change")).toBeNull();
    const input = screen.getByTestId("workout-description-input");
    expect(input.props.value).toBe("");
  });

  it("shows free-form text input for workout description", () => {
    render(<WorkoutLogModal {...defaultProps} />);
    expect(screen.getByText("Workout Description")).toBeOnTheScreen();
    expect(screen.getByTestId("workout-description-input")).toBeOnTheScreen();
  });

  it("shows save as template toggle only when no template selected", () => {
    render(<WorkoutLogModal {...defaultProps} templates={templates} />);
    expect(screen.getByText("Save as template")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Select Push Day"));
    expect(screen.queryByText("Save as template")).toBeNull();
  });

  it("toggling save-as-template reveals template name input", () => {
    render(<WorkoutLogModal {...defaultProps} />);
    expect(screen.queryByTestId("template-name-input")).toBeNull();

    fireEvent(screen.getByTestId("save-template-switch"), "valueChange", true);
    expect(screen.getByTestId("template-name-input")).toBeOnTheScreen();
  });

  it("submitting with empty description shows error", async () => {
    render(<WorkoutLogModal {...defaultProps} />);
    fireEvent.press(screen.getByLabelText("Log workout"));

    await waitFor(() => {
      expect(screen.getByText("Describe your workout to log it")).toBeOnTheScreen();
    });
    expect(defaultProps.onLogWorkout).not.toHaveBeenCalled();
  });

  it("submitting calls onLogWorkout with correct payload", async () => {
    render(<WorkoutLogModal {...defaultProps} templates={templates} />);
    fireEvent.press(screen.getByLabelText("Select Push Day"));
    fireEvent.changeText(
      screen.getByTestId("workout-description-input"),
      "Bench press 3x10, overhead press 3x8, lateral raises 3x12"
    );

    fireEvent.press(screen.getByLabelText("Log workout"));

    await waitFor(() => {
      expect(defaultProps.onLogWorkout).toHaveBeenCalledWith({
        description: "Bench press 3x10, overhead press 3x8, lateral raises 3x12",
        fitbitWorkoutName: "Weights",
        templateId: "t1",
      });
    });
  });

  it("submitting with save-as-template toggled calls onSaveTemplate first then onLogWorkout", async () => {
    const onSaveTemplate = jest.fn().mockResolvedValue(undefined);
    const onLogWorkout = jest.fn().mockResolvedValue(undefined);
    render(
      <WorkoutLogModal
        {...defaultProps}
        onSaveTemplate={onSaveTemplate}
        onLogWorkout={onLogWorkout}
      />
    );

    fireEvent.changeText(screen.getByTestId("workout-description-input"), "Squats 3x10, lunges 3x12");
    fireEvent(screen.getByTestId("save-template-switch"), "valueChange", true);
    fireEvent.changeText(screen.getByTestId("template-name-input"), "Leg Day");

    fireEvent.press(screen.getByLabelText("Log workout"));

    await waitFor(() => {
      expect(onSaveTemplate).toHaveBeenCalledWith({
        name: "Leg Day",
        description: "Squats 3x10, lunges 3x12",
      });
      expect(onLogWorkout).toHaveBeenCalledWith({
        description: "Squats 3x10, lunges 3x12",
        fitbitWorkoutName: "Weights",
        templateId: null,
      });
    });

    // Verify order: onSaveTemplate called before onLogWorkout
    const saveOrder = onSaveTemplate.mock.invocationCallOrder[0];
    const logOrder = onLogWorkout.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(logOrder);
  });

  it("shows Parsing & saving... text when isSaving is true", () => {
    render(<WorkoutLogModal {...defaultProps} isSaving={true} />);
    expect(screen.getByText("Parsing & saving...")).toBeOnTheScreen();
  });

  it("pre-fills description from existingLog when provided", () => {
    render(
      <WorkoutLogModal
        {...defaultProps}
        existingLog={{ description: "Deadlifts 3x5, pull-ups 3x8", exercises: [] }}
      />
    );
    const input = screen.getByTestId("workout-description-input");
    expect(input.props.value).toBe("Deadlifts 3x5, pull-ups 3x8");
  });

  it("shows Update Workout button text when existingLog exists", () => {
    render(
      <WorkoutLogModal
        {...defaultProps}
        existingLog={{ description: "Deadlifts 3x5", exercises: [] }}
      />
    );
    expect(screen.getByText("Update Workout")).toBeOnTheScreen();
    // The header still says "Log Workout", but the submit button should say "Update Workout"
    // Verify "Update Workout" is present inside the submit button
    const submitButton = screen.getByLabelText("Log workout");
    expect(submitButton).toBeOnTheScreen();
  });

  it("calls onClose after successful submit", async () => {
    const onClose = jest.fn();
    const onLogWorkout = jest.fn().mockResolvedValue(undefined);
    render(
      <WorkoutLogModal {...defaultProps} onClose={onClose} onLogWorkout={onLogWorkout} />
    );

    fireEvent.changeText(screen.getByTestId("workout-description-input"), "Push-ups 3x20");
    fireEvent.press(screen.getByLabelText("Log workout"));

    await waitFor(() => {
      expect(onLogWorkout).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
