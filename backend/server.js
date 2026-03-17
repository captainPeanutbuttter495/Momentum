import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Momentum API server running on http://localhost:${port}`);
  console.log(`Database: PostgreSQL via Prisma`);
});
