import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkDatabaseConnection } from './database/db';
import { startScheduler } from './jobs/scheduler';

const startServer = async (): Promise<void> => {
  try {
    // Verify DB is reachable before accepting traffic
    await checkDatabaseConnection();
    startScheduler();

    // Start the server

    const server = app.listen(env.PORT, () => {
      logger.info(`Server running`, {
        port: env.PORT,
        env: env.NODE_ENV,
        url: `http://localhost:${env.PORT}`,
      });
    });

    // ── Graceful shutdown ──────────────────────────────────────────────────────
    // On SIGTERM (Docker stop, Render shutdown) — finish in-flight requests first
    const shutdown = (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force exit after 10s if connections don't close
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C in terminal

    // Catch unhandled promise rejections — log and exit cleanly
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled promise rejection', { reason });
      shutdown('unhandledRejection');
    });

  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
};

startServer();