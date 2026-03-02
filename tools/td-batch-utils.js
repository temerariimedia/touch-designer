export async function executeBatchOperations({
  tdBridgeClient,
  operations,
  stopOnError = true,
  rollbackOnFailure = "none",
  timeoutMs = 5000
}) {
  const results = [];
  const rollbackStack = [];
  const batchStarted = new Date().toISOString();

  for (let i = 0; i < operations.length; i += 1) {
    const operation = operations[i];
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const operationId = operation.id || operation.idempotency_key || `op_${i + 1}`;
    try {
      const result = await tdBridgeClient.send(operation.action, operation.data || {}, timeoutMs);
      results.push({
        operation_id: operationId,
        index: i,
        action: operation.action,
        started_at: startedAt,
        duration_ms: Date.now() - startedMs,
        ok: true,
        result
      });

      const rollback = createRollbackOperation(operation, result);
      if (rollback) {
        rollbackStack.push({
          source_operation_id: operationId,
          ...rollback
        });
      }
    } catch (error) {
      results.push({
        operation_id: operationId,
        index: i,
        action: operation.action,
        started_at: startedAt,
        duration_ms: Date.now() - startedMs,
        ok: false,
        error: {
          message: error.message,
          code: error.code || "operation_failed"
        }
      });

      const rollbackResults = [];
      if (rollbackOnFailure === "best_effort") {
        while (rollbackStack.length > 0) {
          const rollbackOp = rollbackStack.pop();
          const rollbackStartedMs = Date.now();
          try {
            const rollbackResult = await tdBridgeClient.send(rollbackOp.action, rollbackOp.data || {}, timeoutMs);
            rollbackResults.push({
              source_operation_id: rollbackOp.source_operation_id,
              ok: true,
              action: rollbackOp.action,
              duration_ms: Date.now() - rollbackStartedMs,
              result: rollbackResult
            });
          } catch (rollbackError) {
            rollbackResults.push({
              source_operation_id: rollbackOp.source_operation_id,
              ok: false,
              action: rollbackOp.action,
              duration_ms: Date.now() - rollbackStartedMs,
              error: rollbackError.message
            });
          }
        }
      }

      return {
        success: false,
        started_at: batchStarted,
        completed_at: new Date().toISOString(),
        stopIndex: i,
        results,
        rollback: rollbackResults
      };
    }

    if (!stopOnError) {
      continue;
    }
  }

  return {
    success: true,
    started_at: batchStarted,
    completed_at: new Date().toISOString(),
    stopIndex: null,
    results,
    rollback: []
  };
}

function createRollbackOperation(operation, result) {
  if (operation.action === "create_op" && result?.path) {
    return { action: "delete_op", data: { path: result.path } };
  }

  return null;
}
