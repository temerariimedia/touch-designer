import { z } from "zod";
import { resultResponse, errorResponse } from "./td-tool-utils.js";

const allowedActions = new Set([
  "create_op",
  "delete_op",
  "connect_ops",
  "set_param",
  "pulse",
  "exec_node_method"
]);

const operationSchema = z.object({
  action: z.string(),
  data: z.record(z.any()).optional()
});

export const schema = {
  title: "Plan TouchDesigner Network Changes",
  description: "Validate and store a set of network changes without applying them",
  inputSchema: {
    operations: z.array(operationSchema).min(1).max(200)
  }
};

export async function handler({ operations }, { planStore }) {
  try {
    const invalid = operations
      .map((op, index) => ({ op, index }))
      .filter(({ op }) => !allowedActions.has(op.action));

    if (invalid.length > 0) {
      return errorResponse("Plan contains unsupported actions", invalid);
    }

    const plan = planStore.create(operations);
    return resultResponse("TouchDesigner Plan Created", {
      plan_id: plan.id,
      created_at: plan.createdAt,
      operation_count: plan.operations.length,
      operations: plan.operations
    });
  } catch (error) {
    return errorResponse(error.message);
  }
}

