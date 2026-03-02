import { z } from "zod";
import { executeBatchOperations } from "./td-batch-utils.js";
import { resultResponse, errorResponse } from "./td-tool-utils.js";

const operationSchema = z.object({
  action: z.string().describe("Bridge action name"),
  data: z.record(z.any()).optional().describe("Action payload"),
  id: z.string().optional().describe("Optional operation id"),
  idempotency_key: z.string().optional().describe("Optional idempotency key")
});

export const schema = {
  title: "Execute TouchDesigner Batch",
  description: "Execute multiple bridge actions in order with optional best-effort rollback",
  inputSchema: {
    operations: z.array(operationSchema).min(1).max(200),
    stop_on_error: z.boolean().optional().describe("Stop at first failure"),
    rollback_on_failure: z.enum(["none", "best_effort"]).optional().describe("Rollback strategy"),
    timeout_ms: z.number().int().positive().max(120000).optional()
  }
};

export async function handler({
  operations,
  stop_on_error = true,
  rollback_on_failure = "none",
  timeout_ms = 5000
}, { tdBridgeClient }) {
  try {
    const result = await executeBatchOperations({
      tdBridgeClient,
      operations,
      stopOnError: stop_on_error,
      rollbackOnFailure: rollback_on_failure,
      timeoutMs: timeout_ms
    });
    return resultResponse("TouchDesigner Batch Result", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}
