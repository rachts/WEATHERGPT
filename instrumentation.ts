// WeatherGPT — Next.js Server Boot Instrumentation (M14)
// Executes once at server startup to validate critical environment variables fail-fast.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvironmentValid } = await import("./lib/config/environment");
    const { logger } = await import("./lib/utils/logger");

    try {
      assertEnvironmentValid(process.env);
      logger.info("Server startup: Environment configuration verified successfully.");
    } catch (error) {
      logger.error("Server startup: Fail-fast environment validation failed", {
        error: (error as Error).message,
      });

      // Fail closed in production mode
      if (process.env.NODE_ENV === "production" || process.env.WEATHERGPT_MODE === "production") {
        throw error;
      }
    }
  }
}
