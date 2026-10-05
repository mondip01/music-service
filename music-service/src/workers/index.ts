import { connectMongo } from "../infra/mongo";
import { connectRedis } from "../infra/redis";
import { logger } from "../utils/logger";
import { startMediaMetadataWorker } from "./mediaMetadata.worker";
import { startTranscodingWorker } from "./transcoding.worker";
import { startAnalyticsWorker } from "./analytics.worker";
import { registerShutdown } from "../lifecycle/gracefulShutdown";
import { closeConsumers } from "../messaging/consumer";

// Separate process from the API (package.json: `start:worker`), per
// section 23's recommended code structure. Scales independently of the
// HTTP layer - transcoding is CPU-heavy, the API is not.
async function main() {
  await connectMongo();
  await connectRedis();
  registerShutdown({ stopConsumers: closeConsumers });
  await Promise.all([startMediaMetadataWorker(), startTranscodingWorker(), startAnalyticsWorker()]);
  logger.info("all_workers_started");
}

main().catch((err) => {
  logger.error({ err }, "fatal_worker_startup_error");
  process.exit(1);
});
