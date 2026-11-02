import express from "express";
import { createRuntime } from "./src/runtime.js";
import { errorHandler } from "./src/errors.js";

// Vercel imports this entry without opening a port or connecting during build.
const app = express();
app.disable("x-powered-by");
let runtime;
app.use(async (req, res, next) => {
  try {
    // Concurrent cold-start requests share one connection pool.
    runtime ??= createRuntime().catch((error) => {
      runtime = undefined;
      throw error;
    });
    const service = await runtime;
    service.app(req, res, next);
  } catch (error) {
    next(error);
  }
});
app.use(errorHandler);
export default app;
