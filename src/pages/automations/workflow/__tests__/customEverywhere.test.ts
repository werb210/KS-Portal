// KS_PORTAL_CUSTOM_EVERYWHERE_v1
import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../workflowApi";
import { ACTIONS } from "../actions";

describe("your properties and pipelines in the workflow builder", () => {
  it("keeps the brokerage's properties and pipelines from the catalog", () => {
    const c = normalizeCatalog({
      fields: [{ key: "deal_cf_equipment_type", label: "Deal: Equipment type", type: "text" }],
      customFields: [{ key: "deal_cf_equipment_type", label: "Deal: Equipment type", type: "text", options: ["Truck", "Excavator"] }],
      pipelines: [{ id: "p1", name: "Renewals", stages: ["Due", "Quoted"] }],
    });
    expect(c.customFields?.[0]).toMatchObject({ key: "deal_cf_equipment_type", label: "Deal: Equipment type" });
    expect(c.pipelines).toEqual([{ id: "p1", name: "Renewals", stages: ["Due", "Quoted"] }]);
    expect(c.fields.map((f) => f.key)).toContain("deal_cf_equipment_type");
  });
  it("offers the two new actions", () => {
    expect(ACTIONS.map((a) => a.key)).toEqual(expect.arrayContaining(["set_custom_field", "move_pipeline_stage"]));
  });
});
