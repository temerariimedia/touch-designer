import { z } from "zod";
import { resultResponse, errorResponse } from "./td-tool-utils.js";

export const schema = {
  title: "Get TouchDesigner Bridge State",
  description: "Return websocket bridge state, reconnect status, and active plans",
  inputSchema: {}
};

export async function handler(_params, { tdBridgeClient, capabilityManager, planStore }) {
  try {
    return resultResponse("TouchDesigner Bridge State", {
      bridge: tdBridgeClient.getStatus(),
      capabilities: capabilityManager?.getPolicy?.() || null,
      plans: planStore?.list?.() || []
    });
  } catch (error) {
    return errorResponse(error.message);
  }
}

