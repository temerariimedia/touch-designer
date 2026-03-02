import crypto from "crypto";

export default class TdPlanStore {
  constructor() {
    this.plans = new Map();
  }

  create(operations) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const plan = {
      id,
      createdAt,
      operations
    };
    this.plans.set(id, plan);
    return plan;
  }

  get(planId) {
    return this.plans.get(planId) || null;
  }

  delete(planId) {
    return this.plans.delete(planId);
  }

  list() {
    return Array.from(this.plans.values()).map((plan) => ({
      id: plan.id,
      createdAt: plan.createdAt,
      operationCount: plan.operations.length
    }));
  }
}
