import { createRuntime } from "./runtime.js";
const { app, client, config } = await createRuntime();
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
