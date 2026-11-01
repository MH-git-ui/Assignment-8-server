import { readConfig } from "./config.js";
import { connectDatabase } from "./db.js";
import { createApp } from "./app.js";
import { createTokenVerifier, requireAuth } from "./auth.js";
import { bookReads } from "./book-reads.js";
import { bookWrites } from "./book-writes.js";
import { borrowRoutes } from "./borrows.js";
const config = readConfig();
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
const server = app.listen(config.port, () =>
  console.log(`BookNook API listening on http://localhost:${config.port}`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () =>
    server.close(async () => {
      await client.close();
      process.exit(0);
    }),
  );
