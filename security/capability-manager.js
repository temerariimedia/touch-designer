import { existsSync, readFileSync } from "fs";
import { join } from "path";

const DEFAULT_POLICY = {
  allow_eval: true,
  allow_network_mutation: true,
  allow_script_execution: false,
  allow_destructive_ops: false,
  allow_project_io: false
};

const ACTION_CAPABILITY_MAP = {
  eval: "allow_eval",
  run_script: "allow_script_execution",
  delete_op: "allow_destructive_ops",
  open_project: "allow_project_io",
  save_project: "allow_project_io",
  create_op: "allow_network_mutation",
  connect_ops: "allow_network_mutation",
  set_param: "allow_network_mutation",
  pulse: "allow_network_mutation",
  execute_batch: "allow_network_mutation",
  apply_network_changes: "allow_network_mutation",
  export_snapshot: "allow_network_mutation",
  capture_performance: "allow_network_mutation",
  test_reset_workspace: "allow_destructive_ops"
};

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export default class CapabilityManager {
  constructor({ configPath } = {}) {
    this.configPath = configPath || join(process.cwd(), "config", "td-capabilities.json");
    this.policy = { ...DEFAULT_POLICY };
    this.reload();
  }

  reload() {
    let filePolicy = {};
    if (existsSync(this.configPath)) {
      try {
        filePolicy = JSON.parse(readFileSync(this.configPath, "utf8"));
      } catch (error) {
        // Keep default policy and continue with environment overrides
      }
    }

    const merged = { ...DEFAULT_POLICY, ...filePolicy };
    this.policy = {
      allow_eval: parseBoolean(process.env.TD_ALLOW_EVAL, merged.allow_eval),
      allow_network_mutation: parseBoolean(process.env.TD_ALLOW_NETWORK_MUTATION, merged.allow_network_mutation),
      allow_script_execution: parseBoolean(process.env.TD_ALLOW_SCRIPT_EXECUTION, merged.allow_script_execution),
      allow_destructive_ops: parseBoolean(process.env.TD_ALLOW_DESTRUCTIVE_OPS, merged.allow_destructive_ops),
      allow_project_io: parseBoolean(process.env.TD_ALLOW_PROJECT_IO, merged.allow_project_io)
    };
  }

  getPolicy() {
    return { ...this.policy };
  }

  getRequiredCapability(action) {
    return ACTION_CAPABILITY_MAP[action] || null;
  }

  assertActionAllowed(action) {
    const capability = this.getRequiredCapability(action);
    if (!capability) {
      return;
    }

    if (!this.policy[capability]) {
      const envName = `TD_${capability.replace("allow_", "ALLOW_").toUpperCase()}`;
      throw new Error(
        `Action '${action}' requires capability '${capability}'. Enable it via ${envName}=true or config/td-capabilities.json.`
      );
    }
  }

  assertActionAllowedWithData(action, data = {}) {
    if (action === "test_reset_workspace" && data && data.dry_run === true) {
      return;
    }
    this.assertActionAllowed(action);
  }
}
