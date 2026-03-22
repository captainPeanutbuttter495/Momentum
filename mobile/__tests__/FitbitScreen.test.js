import { render, screen, waitFor } from "@testing-library/react-native";

const mockGetCredentials = jest.fn();
const mockUseAuth0 = jest.fn();

jest.mock("react-native-auth0", () => ({
  useAuth0: () => mockUseAuth0(),
  Auth0Provider: ({ children }) => children,
}));

const mockGetFitbitAuthUrl = jest.fn();
const mockGetFitbitStatus = jest.fn();
const mockGetFitbitSleep = jest.fn();
const mockGetFitbitActivity = jest.fn();
const mockGetFitbitHeartRate = jest.fn();
const mockDisconnectFitbit = jest.fn();

jest.mock("../services/fitbit", () => ({
  getFitbitAuthUrl: (...args) => mockGetFitbitAuthUrl(...args),
  getFitbitStatus: (...args) => mockGetFitbitStatus(...args),
  getFitbitSleep: (...args) => mockGetFitbitSleep(...args),
  getFitbitActivity: (...args) => mockGetFitbitActivity(...args),
  getFitbitHeartRate: (...args) => mockGetFitbitHeartRate(...args),
  disconnectFitbit: (...args) => mockDisconnectFitbit(...args),
}));

jest.mock("../services/api", () => ({
  createApiClient: jest.fn(() => ({ get: jest.fn(), delete: jest.fn() })),
}));

import FitbitScreen from "../app/screens/FitbitScreen";

// ─── Test Data ─────────────────────────────────────────────────────

const mockSleepData = {
  date: "2026-03-16",
  summary: {
    totalMinutesAsleep: 420,
    totalTimeInBed: 480,
    stages: { deep: 90, light: 180, rem: 120, wake: 30 },
  },
  sleepLog: [
    {
      startTime: "2026-03-15T23:00:00",
      endTime: "2026-03-16T07:00:00",
      efficiency: 88,
      levels: {
        data: [
          { level: "light", dateTime: "2026-03-15T23:00:00", seconds: 600 },
          { level: "deep", dateTime: "2026-03-15T23:10:00", seconds: 1800 },
        ],
        summary: {},
      },
    },
  ],
};

const mockActivityData = {
  date: "2026-03-16",
  steps: 8500,
  distance: 3.8,
  caloriesOut: 2100,
};

const mockHeartRateData = {
  date: "2026-03-16",
  restingHeartRate: 62,
  zones: [
    { name: "Out of Range", min: 30, max: 104, minutes: 1200 },
    { name: "Fat Burn", min: 104, max: 134, minutes: 45 },
    { name: "Cardio", min: 134, max: 167, minutes: 12 },
    { name: "Peak", min: 167, max: 220, minutes: 3 },
  ],
};

function setupConnectedMocks() {
  mockGetFitbitStatus.mockResolvedValue({ connected: true });
  mockGetFitbitSleep.mockResolvedValue(mockSleepData);
  mockGetFitbitActivity.mockResolvedValue(mockActivityData);
  mockGetFitbitHeartRate.mockResolvedValue(mockHeartRateData);
}

// ─── Tests ─────────────────────────────────────────────────────────

describe("FitbitScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth0.mockReturnValue({
      getCredentials: mockGetCredentials,
    });
    mockGetCredentials.mockResolvedValue({ accessToken: "test-token" });
  });

  // ── Loading State ──────────────────────────────────────────────

  it("shows loading spinner while checking connection", () => {
    mockGetFitbitStatus.mockReturnValue(new Promise(() => {}));
    render(<FitbitScreen />);
    expect(screen.getByText("Checking connection...")).toBeOnTheScreen();
  });

  // ── Disconnected State ─────────────────────────────────────────

  it("shows connect button when not connected", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: false });
    render(<FitbitScreen />);

    expect(await screen.findByLabelText("Connect Fitbit")).toBeOnTheScreen();
  });

  it("shows description text when disconnected", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: false });
    render(<FitbitScreen />);

    expect(
      await screen.findByText("Connect your Fitbit to view sleep, activity, and heart rate data")
    ).toBeOnTheScreen();
  });

  // ── Connected State — Activity ─────────────────────────────────

  it("displays steps and distance when connected", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("8,500")).toBeOnTheScreen();
    expect(screen.getByText("Steps")).toBeOnTheScreen();
    expect(screen.getByText("3.8")).toBeOnTheScreen();
    expect(screen.getByText("Miles")).toBeOnTheScreen();
  });

  it("shows 'No activity data' when activity fails", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockRejectedValue(new Error("fail"));
    mockGetFitbitHeartRate.mockResolvedValue(mockHeartRateData);

    render(<FitbitScreen />);

    expect(await screen.findByText("No activity data")).toBeOnTheScreen();
  });

  // ── Connected State — Workouts ────────────────────────────────

  it("displays workouts with names and details when present", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockResolvedValue({
      ...mockActivityData,
      workouts: [
        { name: "Run", calories: 320, duration: 2700000, startTime: "2026-03-16T07:00:00.000", steps: 4200 },
        { name: "Weights", calories: 450, duration: 4500000, startTime: "2026-03-16T17:30:00.000", steps: 0 },
      ],
    });
    mockGetFitbitHeartRate.mockResolvedValue(mockHeartRateData);

    render(<FitbitScreen />);

    expect(await screen.findByText("Workouts")).toBeOnTheScreen();
    expect(screen.getByText("Run")).toBeOnTheScreen();
    expect(screen.getByText("Weights")).toBeOnTheScreen();
    expect(screen.getByText("320 cal")).toBeOnTheScreen();
    expect(screen.getByText("450 cal")).toBeOnTheScreen();
    expect(screen.getByText("45m")).toBeOnTheScreen();
    expect(screen.getByText("1h 15m")).toBeOnTheScreen();
  });

  it("shows 'No workouts for today' when workouts array is empty", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockResolvedValue({
      ...mockActivityData,
      workouts: [],
    });
    mockGetFitbitHeartRate.mockResolvedValue(mockHeartRateData);

    render(<FitbitScreen />);

    expect(await screen.findByText("No workouts for today")).toBeOnTheScreen();
  });

  it("shows 'No workouts for today' when workouts field is missing", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("No workouts for today")).toBeOnTheScreen();
  });

  // ── Connected State — Heart Rate ───────────────────────────────

  it("displays resting heart rate", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("62")).toBeOnTheScreen();
    expect(screen.getByText("Resting BPM")).toBeOnTheScreen();
  });

  it("displays Cardio and Peak zones", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("Cardio")).toBeOnTheScreen();
    expect(screen.getByText("Peak")).toBeOnTheScreen();
  });

  it("shows 'No heart rate data' when heart rate fails", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockResolvedValue(mockActivityData);
    mockGetFitbitHeartRate.mockRejectedValue(new Error("fail"));

    render(<FitbitScreen />);

    expect(await screen.findByText("No heart rate data")).toBeOnTheScreen();
  });

  // ── Connected State — Sleep ────────────────────────────────────

  it("displays sleep summary (asleep and in bed)", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("Asleep")).toBeOnTheScreen();
    expect(screen.getByText("7h")).toBeOnTheScreen();
    expect(screen.getByText("8h")).toBeOnTheScreen();
    expect(screen.getByText("In Bed")).toBeOnTheScreen();
  });

  it("displays sleep stages section", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("Sleep Stages")).toBeOnTheScreen();
    // Stage labels appear in both stages section and hypnogram legend
    expect(screen.getAllByText("Deep").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Light").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("REM").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Awake").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'No sleep data' when sleep log is empty", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue({
      date: "2026-03-16",
      summary: { totalMinutesAsleep: 0, totalTimeInBed: 0, stages: {} },
      sleepLog: [],
    });
    mockGetFitbitActivity.mockResolvedValue(mockActivityData);
    mockGetFitbitHeartRate.mockResolvedValue(mockHeartRateData);

    render(<FitbitScreen />);

    expect(await screen.findByText("No sleep data for this date")).toBeOnTheScreen();
  });

  // ── Disconnect ─────────────────────────────────────────────────

  it("shows disconnect button when connected", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByLabelText("Disconnect Fitbit")).toBeOnTheScreen();
  });

  // ── Date Navigation ────────────────────────────────────────────

  it("shows date selector with previous and next buttons", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByLabelText("Previous day")).toBeOnTheScreen();
    expect(screen.getByLabelText("Next day")).toBeOnTheScreen();
  });

  // ── Header ─────────────────────────────────────────────────────

  it("shows Fitbit header when connected", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("Fitbit")).toBeOnTheScreen();
    expect(screen.getByText("Sleep, Activity & Heart Rate")).toBeOnTheScreen();
  });

  // ── Connected State — Activity (Calories & Active Minutes) ────

  it("displays calories burned when connected", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("2,100")).toBeOnTheScreen();
    expect(screen.getByText("Calories")).toBeOnTheScreen();
  });

  it("displays active minutes when connected", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockResolvedValue({
      ...mockActivityData,
      activeMinutes: {
        sedentary: 600,
        lightlyActive: 120,
        fairlyActive: 25,
        veryActive: 15,
      },
    });
    mockGetFitbitHeartRate.mockResolvedValue(mockHeartRateData);

    render(<FitbitScreen />);

    // fairlyActive (25) + veryActive (15) = 40
    expect(await screen.findByText("40")).toBeOnTheScreen();
    expect(screen.getByText("Active Min")).toBeOnTheScreen();
  });

  // ── Connected State — Sleep Score & Consistency ──────────────

  it("displays sleep score from efficiency", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("88")).toBeOnTheScreen();
    expect(screen.getByText("Sleep Score")).toBeOnTheScreen();
  });

  it("displays bedtime and wake time", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByText("Bedtime")).toBeOnTheScreen();
    expect(screen.getByText("Wake Time")).toBeOnTheScreen();
  });

  // ── Connected State — Heart Rate Delta ───────────────────────

  it("shows no change when resting HR is same as yesterday", async () => {
    setupConnectedMocks();
    // setupConnectedMocks returns same HR data for both calls
    render(<FitbitScreen />);

    expect(await screen.findByText("No change from yesterday")).toBeOnTheScreen();
  });

  it("shows HR increase from yesterday", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockResolvedValue(mockActivityData);
    // First call = current day (HR 65), second call = previous day (HR 62)
    mockGetFitbitHeartRate
      .mockResolvedValueOnce({ ...mockHeartRateData, restingHeartRate: 65 })
      .mockResolvedValueOnce({ ...mockHeartRateData, restingHeartRate: 62 });

    render(<FitbitScreen />);

    expect(await screen.findByText("3 BPM from yesterday")).toBeOnTheScreen();
    // Up arrow should be rendered (icon mock renders name as text)
    expect(screen.getByText("arrow-up")).toBeOnTheScreen();
  });

  it("shows HR decrease from yesterday", async () => {
    mockGetFitbitStatus.mockResolvedValue({ connected: true });
    mockGetFitbitSleep.mockResolvedValue(mockSleepData);
    mockGetFitbitActivity.mockResolvedValue(mockActivityData);
    // First call = current day (HR 59), second call = previous day (HR 62)
    mockGetFitbitHeartRate
      .mockResolvedValueOnce({ ...mockHeartRateData, restingHeartRate: 59 })
      .mockResolvedValueOnce({ ...mockHeartRateData, restingHeartRate: 62 });

    render(<FitbitScreen />);

    expect(await screen.findByText("3 BPM from yesterday")).toBeOnTheScreen();
    expect(screen.getByText("arrow-down")).toBeOnTheScreen();
  });

  // ── Date Navigation — Calendar ───────────────────────────────

  it("shows calendar open button in date selector", async () => {
    setupConnectedMocks();
    render(<FitbitScreen />);

    expect(await screen.findByLabelText("Open calendar")).toBeOnTheScreen();
  });

  // ── Error State ────────────────────────────────────────────────

  it("shows error when status check fails", async () => {
    mockGetFitbitStatus.mockRejectedValue(new Error("Network error"));
    render(<FitbitScreen />);

    expect(
      await screen.findByText("Failed to check Fitbit connection status")
    ).toBeOnTheScreen();
  });
});
