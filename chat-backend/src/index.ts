import { createServer } from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const startServer = async () => {
  try {
    const server = await createServer();
    await server.start();
    logger.info(`Server running on port ${env.port}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();