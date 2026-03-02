import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Reset TouchDesigner Workspace for Testing",
  description: "Delete direct children under a parent path except explicitly preserved paths",
  inputSchema: {
    parent: z.string().optional().describe("Parent path to reset (default /project1)"),
    keep_paths: z.array(z.string()).optional().describe("Paths to preserve"),
    dry_run: z.boolean().optional().describe("Preview deletions without mutation")
  }
};

export async function handler({
  parent = "/project1",
  keep_paths = [],
  dry_run = false
}, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "test_reset_workspace",
      data: {
        parent,
        keep_paths,
        dry_run
      }
    });
    return resultResponse("TouchDesigner Workspace Reset", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}

