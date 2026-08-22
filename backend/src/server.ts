import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "./shared/utils/logger";

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: "0.0.0.0" });
    logger.info({ port: config.PORT, env: config.NODE_ENV }, "TaskFlow API started");
    logger.info(`Swagger UI available at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    logger.error({ err }, "Failed to start TaskFlow API");
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

main();
