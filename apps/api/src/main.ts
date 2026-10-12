import { Game } from "@guerra-naval/core";
import { buildServer } from "./server";

// One local player, so one game per process.
const app = buildServer(new Game());
const port = Number(process.env.PORT ?? 3000);

app.listen({ port, host: "127.0.0.1" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
