import { readConfig } from "./config.js";
import { connectDatabase } from "./db.js";
import { createApp } from "./app.js";
import { createTokenVerifier, requireAuth } from "./auth.js";
import { bookReads } from "./book-reads.js";
import { bookWrites } from "./book-writes.js";
import { borrowRoutes } from "./borrows.js";
export async function createRuntime(config = readConfig()) {
  const { client, db } = await connectDatabase(config);
  const context = {
    config,
    client,
    db,
    auth: requireAuth(createTokenVerifier(config)),
  };
  const app = createApp({
    config,
    routes: [bookReads(context), bookWrites(context), borrowRoutes(context)],
  });

  return { app, client, config };
}
