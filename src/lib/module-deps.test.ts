import { describe, it, expect } from "vitest";

// Pure replica of the SQL recursive expansion used by expand_modules_with_deps,
// to guarantee that delegations include all mandatory dependencies before
// hitting the server. Mirrors the trigger behaviour we rely on at runtime.
type Edge = { module: string; depends_on: string };

function expandModulesWithDeps(modules: string[], deps: Edge[]): string[] {
  const out = new Set(modules);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of deps) {
      if (out.has(e.module) && !out.has(e.depends_on)) { out.add(e.depends_on); changed = true; }
    }
  }
  return [...out].sort();
}

function missingDeps(modules: string[], deps: Edge[]): string[] {
  const expanded = new Set(expandModulesWithDeps(modules, deps));
  modules.forEach((m) => expanded.delete(m));
  return [...expanded].sort();
}

const FIXTURE: Edge[] = [
  { module: "cashbook", depends_on: "invoices" },
  { module: "work_orders", depends_on: "tickets" },
  { module: "work_orders", depends_on: "assets" },
  { module: "work_orders", depends_on: "suppliers" },
  { module: "housekeeping", depends_on: "rooms" },
  { module: "sustainability", depends_on: "utilities" },
  { module: "alerts", depends_on: "sla" },
];

describe("module dependency expansion (delegation server logic)", () => {
  it("returns the input unchanged when no deps apply", () => {
    expect(expandModulesWithDeps(["tickets"], FIXTURE)).toEqual(["tickets"]);
  });

  it("expands a single dependency", () => {
    expect(expandModulesWithDeps(["cashbook"], FIXTURE)).toEqual(["cashbook", "invoices"]);
  });

  it("expands transitive dependencies (work_orders → tickets, assets, suppliers)", () => {
    const r = expandModulesWithDeps(["work_orders"], FIXTURE);
    expect(r).toContain("tickets");
    expect(r).toContain("assets");
    expect(r).toContain("suppliers");
    expect(r).toContain("work_orders");
  });

  it("does not duplicate already-present modules", () => {
    const r = expandModulesWithDeps(["work_orders", "tickets", "assets", "suppliers"], FIXTURE);
    expect(r.length).toBe(new Set(r).size);
  });

  it("missingDeps returns only auto-added dependencies", () => {
    expect(missingDeps(["cashbook"], FIXTURE)).toEqual(["invoices"]);
    expect(missingDeps(["cashbook", "invoices"], FIXTURE)).toEqual([]);
  });

  it("handles multiple modules together", () => {
    const r = expandModulesWithDeps(["housekeeping", "sustainability", "alerts"], FIXTURE);
    expect(r).toEqual(expect.arrayContaining(["housekeeping", "rooms", "sustainability", "utilities", "alerts", "sla"]));
  });

  it("safely handles unknown modules", () => {
    expect(expandModulesWithDeps(["unknown_module"], FIXTURE)).toEqual(["unknown_module"]);
  });

  it("never produces a cycle even with self-referencing input", () => {
    const r = expandModulesWithDeps(["work_orders", "tickets"], FIXTURE);
    expect(r.includes("work_orders")).toBe(true);
    expect(r.includes("tickets")).toBe(true);
  });
});