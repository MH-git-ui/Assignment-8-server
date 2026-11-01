import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { errorHandler } from "./errors.js";
export function createApp({ config, routes = [] }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: config.origin,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { message: "Too many requests. Please try again shortly." },
    }),
  );
  for (const route of routes) app.use(route);
  app.use((req, res) =>
    res.status(404).json({ message: "This endpoint does not exist." }),
  );
  app.use(errorHandler);
  return app;
}
