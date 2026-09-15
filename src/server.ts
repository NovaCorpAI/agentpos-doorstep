/** Local entry point: one process, one SQLite file. */
import { serve } from "@hono/node-server";
import { loadConfig } from "./config.js";
import { SqliteStorage } from "./storage/sqlite.js";
import { createApp } from "./web/app.js";

const config = loadConfig();
const storage = new SqliteStorage(config.dbPath);
const app = createApp({ config, storage });

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(JSON.stringify({ level: "info", code: "LISTENING", port: info.port, webhook: `${config.publicBaseUrl}/ring/webhook` }));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    storage.close();
    process.exit(0);
  });
}
