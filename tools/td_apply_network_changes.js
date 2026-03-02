import { z } from "zod";
import { executeBatchOperations } from "./td-batch-utils.js";
import { resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Apply Planned TouchDesigner Changes",
  description: "Apply a previously planned network change set",
  inputSchema: {
    plan_id: z.string().describe("Plan id returned by td_plan_network_changes"),
    rollback_on_failure: z.enum(["none", "best_effort"]).optional(),
    timeout_ms: z.number().int().positive().max(120000).optional(),
    delete_after_apply: z.boolean().optional()
  }
};

export async function handler({
  plan_id,
  rollback_on_failure = "none",
  timeout_ms = 5000,
  delete_after_apply = true
}, { tdBridgeClient, planStore }) {
  try {
    const plan = planStore.get(plan_id);
    if (!plan) {
      return errorResponse(`Plan not found: ${plan_id}`);
    }

    const result = await executeBatchOperations({
      tdBridgeClient,
      operations: plan.operations,
      stopOnError: true,
      rollbackOnFailure: rollback_on_failure,
      timeoutMs: timeout_ms
    });

    if (delete_after_apply && result.success) {
      planStore.delete(plan_id);
    }

    const appliedOperationIds = (result.results || [])
      .filter((entry) => entry.ok)
      .map((entry) => entry.operation_id);

    return resultResponse("TouchDesigner Plan Apply Result", {
      plan_id,
      plan_deleted: delete_after_apply && result.success,
      applied_operation_ids: appliedOperationIds,
      rollback_report: result.rollback || [],
      ...result
    });
  } catch (error) {
    return errorResponse(error.message);
  }
}
