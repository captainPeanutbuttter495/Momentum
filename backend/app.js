import express from "express";
import cors from "cors";
import fitbitRoutes from "./routes/fitbit.js";

const app = express();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl)
      if (!origin) return callback(null, true);
      return callback(null, true);
    },
  }),
);

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/fitbit", fitbitRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({ error: "Invalid or missing token" });
  }

  res.status(500).json({ error: "Internal server error" });
});

export default app;
