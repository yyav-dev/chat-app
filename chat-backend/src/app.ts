import Hapi from "@hapi/hapi";
import { env } from "./config/env";
import { registerJwt } from "./config/auth";
import { registerHealthRoute } from "./routes/health.route";
import { registerAuthRoutes } from "./routes/auth.route";
import { registerUserRoutes } from "./routes/user.route";
import { registerRoomRoutes } from "./routes/room.route";
import { errorHandler } from "./middleware/errorHandler";
import { createSocketServer } from "./config/socket";

export const createServer = async () => {
  const server = Hapi.server({
    port: env.port,
    host: "0.0.0.0",
    routes: {
      cors: {
        origin: ["*"],
        credentials: true,
      },
    },
  });
  await registerJwt(server);
  registerHealthRoute(server);
  registerAuthRoutes(server);
  registerUserRoutes(server);
  registerRoomRoutes(server);

  server.ext("onPreResponse", errorHandler);

  const socketServer = await createSocketServer(server.listener);
  (server as Hapi.Server & { app: { socketServer?: unknown } }).app.socketServer = socketServer;

  return server;
};