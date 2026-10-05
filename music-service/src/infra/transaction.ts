import mongoose from "mongoose";
import logger from "../utils/logger";

/**
 * Detects whether the connected MongoDB deployment supports transactions.
 * The result is informational for now; services can use it to decide whether
 * a multi-document transaction is safe without changing the boot contract.
 */
export async function detectTransactionSupport(): Promise<boolean> {
  try {
    const db = mongoose.connection.db;
    if (!db) return false;

    const hello = await db.admin().command({ hello: 1 });
    const supported = Boolean(hello.setName || hello.msg === "isdbgrid");
    logger.info({ supported }, "mongo_transaction_support_detected");
    return supported;
  } catch (err: any) {
    logger.warn({ err: err?.message }, "mongo_transaction_support_detection_failed");
    return false;
  }
}
