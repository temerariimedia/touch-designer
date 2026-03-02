import { z } from "zod";
import { runBridgeAction, resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Capture TouchDesigner Performance",
  description: "Capture available runtime/cook/frame performance metrics",
  inputSchema: {
    duration_frames: z.number().int().positive().max(10000).optional().describe("Requested sampling frame window")
  }
};

export async function handler({ duration_frames = 120 }, { tdBridgeClient }) {
  try {
    const result = await runBridgeAction({
      tdBridgeClient,
      action: "capture_performance",
      data: {
        duration_frames
      }
    });
    return resultResponse("TouchDesigner Performance Snapshot", result);
  } catch (error) {
    return errorResponse(error.message);
  }
}

