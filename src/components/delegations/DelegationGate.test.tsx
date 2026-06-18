/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DelegationGate } from "./DelegationGate";
import type { DelegationRow } from "@/lib/use-permission";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) },
}));

// Force the queryFn to read from the live React Query cache so that
// `setQueryData` updates are reflected immediately and no async fetch
// resets them mid-test. The hook still uses TanStack Query exactly like
// in production, we only redirect the data source for the test.
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<any>("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (opts: any) => {
      const qc = actual.useQueryClient();
      const data = qc.getQueryData(opts.queryKey) ?? [];
      // subscribe to changes for re-render
      actual.useQueryClient(); // no-op, keep hook order stable
      const [, force] = actual.useReducer ? [0, () => {}] : [0, () => {}];
      // use a real subscriber
      const React = require("react");
      const [, setTick] = React.useState(0);
      React.useEffect(() => {
        const unsub = qc.getQueryCache().subscribe((e: any) => {
          if (e?.query?.queryHash === JSON.stringify(opts.queryKey)) setTick((t: number) => t + 1);
        });
        return unsub;
      }, [qc, JSON.stringify(opts.queryKey)]);
      return { data, isLoading: false, isError: false, error: null } as any;
    },
  };
});

const USER = "user-1";
const STRUCT_A = "struct-a";
const STRUCT_B = "struct-b";

function makeDelegation(over: Partial<DelegationRow> = {}): DelegationRow {
  return {
    id: crypto.randomUUID(),
    delegate_id: USER,
    delegator_id: "boss",
    structure_id: null,
    modules: ["tickets"],
    starts_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: null,
    active: true,
    ...over,
  };
}

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const key = ["delegations:incoming", USER];
  qc.setQueryData<DelegationRow[]>(key, []);
  return { qc, Wrapper, key };
}

describe("DelegationGate — UI reactivity on grant/revoke", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts disabled when no delegation exists", () => {
    const { Wrapper } = setup();
    render(
      <Wrapper>
        <DelegationGate userId={USER} module="tickets">
          {({ disabled }) => <button disabled={disabled}>Apri ticket</button>}
        </DelegationGate>
      </Wrapper>,
    );
    expect(screen.getByTestId("gate-tickets").dataset.enabled).toBe("false");
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("enables immediately when a delegation is granted for that module", () => {
    const { qc, Wrapper, key } = setup();
    render(
      <Wrapper>
        <DelegationGate userId={USER} module="tickets">
          {({ disabled }) => <button disabled={disabled}>Apri ticket</button>}
        </DelegationGate>
      </Wrapper>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    act(() => { qc.setQueryData<DelegationRow[]>(key, [makeDelegation()]); });
    expect(screen.getByTestId("gate-tickets").dataset.enabled).toBe("true");
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("disables immediately when the matching delegation is revoked", () => {
    const { qc, Wrapper, key } = setup();
    qc.setQueryData<DelegationRow[]>(key, [makeDelegation()]);
    render(
      <Wrapper>
        <DelegationGate userId={USER} module="tickets">
          {({ disabled }) => <button disabled={disabled}>Apri ticket</button>}
        </DelegationGate>
      </Wrapper>,
    );
    expect(screen.getByRole("button")).not.toBeDisabled();
    act(() => { qc.setQueryData<DelegationRow[]>(key, []); });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("respects the active=false (suspended) flag in real time", () => {
    const { qc, Wrapper, key } = setup();
    const d = makeDelegation();
    qc.setQueryData<DelegationRow[]>(key, [d]);
    render(
      <Wrapper>
        <DelegationGate userId={USER} module="tickets">
          {({ disabled }) => <button disabled={disabled}>Apri ticket</button>}
        </DelegationGate>
      </Wrapper>,
    );
    expect(screen.getByRole("button")).not.toBeDisabled();
    act(() => { qc.setQueryData<DelegationRow[]>(key, [{ ...d, active: false }]); });
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("scopes by structure: enabled for matching, disabled for others", () => {
    const { qc, Wrapper, key } = setup();
    qc.setQueryData<DelegationRow[]>(key, [makeDelegation({ structure_id: STRUCT_A })]);
    render(
      <Wrapper>
        <DelegationGate userId={USER} module="tickets" structureId={STRUCT_A}>
          {({ disabled }) => <button data-testid="a" disabled={disabled}>A</button>}
        </DelegationGate>
        <DelegationGate userId={USER} module="tickets" structureId={STRUCT_B}>
          {({ disabled }) => <button data-testid="b" disabled={disabled}>B</button>}
        </DelegationGate>
      </Wrapper>,
    );
    expect(screen.getByTestId("a")).not.toBeDisabled();
    expect(screen.getByTestId("b")).toBeDisabled();
  });

  it("scopes by single function: tickets vs invoices", () => {
    const { qc, Wrapper, key } = setup();
    qc.setQueryData<DelegationRow[]>(key, [makeDelegation({ modules: ["tickets"] })]);
    render(
      <Wrapper>
        <DelegationGate userId={USER} module="tickets">
          {({ disabled }) => <button data-testid="t" disabled={disabled}>T</button>}
        </DelegationGate>
        <DelegationGate userId={USER} module="invoices">
          {({ disabled }) => <button data-testid="i" disabled={disabled}>I</button>}
        </DelegationGate>
      </Wrapper>,
    );
    expect(screen.getByTestId("t")).not.toBeDisabled();
    expect(screen.getByTestId("i")).toBeDisabled();

    // Grant invoices too → both enabled instantly
    act(() => {
      qc.setQueryData<DelegationRow[]>(key, [
        makeDelegation({ modules: ["tickets"] }),
        makeDelegation({ modules: ["invoices"] }),
      ]);
    });
    expect(screen.getByTestId("t")).not.toBeDisabled();
    expect(screen.getByTestId("i")).not.toBeDisabled();
  });
});