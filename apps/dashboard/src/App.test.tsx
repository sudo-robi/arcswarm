import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Dashboard from "./App";

const trpcMock = vi.hoisted(() => {
  const m = {
    vaultGetAll: vi.fn(),
    vaultGetLiveData: vi.fn(),
    agentGetAll: vi.fn(),
    riskGetLiveScore: vi.fn(),
    riskGetAlerts: vi.fn(),
    transactionGetAll: vi.fn(),
    stats: vi.fn(),
  };
  return {
    m,
    trpc: {
      vault: {
        getAll: { useQuery: m.vaultGetAll },
        getLiveData: { useQuery: m.vaultGetLiveData },
      },
      agent: { getAll: { useQuery: m.agentGetAll } },
      risk: {
        getLiveScore: { useQuery: m.riskGetLiveScore },
        getAlerts: { useQuery: m.riskGetAlerts },
      },
      transaction: { getAll: { useQuery: m.transactionGetAll } },
      stats: { useQuery: m.stats },
    },
  };
});

vi.mock("@/providers", () => ({ trpc: trpcMock.trpc }));

const activeVault = {
  id: "v1",
  address: "0x86014c6473574F93d4BFc386541681f8c1200160",
  isActive: true,
};

describe("Dashboard", () => {
  beforeEach(() => {
    trpcMock.m.vaultGetAll.mockReset();
    trpcMock.m.vaultGetLiveData.mockReset();
    trpcMock.m.agentGetAll.mockReset();
    trpcMock.m.riskGetLiveScore.mockReset();
    trpcMock.m.riskGetAlerts.mockReset();
    trpcMock.m.transactionGetAll.mockReset();
    trpcMock.m.stats.mockReset();
  });

  it("renders the header and brand", () => {
    trpcMock.m.vaultGetAll.mockReturnValue({ data: [] });
    render(<Dashboard />);
    expect(screen.getByRole("heading", { name: /arcswarm/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByText(/treasury os/i)).toBeInTheDocument();
  });

  it("shows the empty state and vault form when no active vault exists", () => {
    trpcMock.m.vaultGetAll.mockReturnValue({ data: [] });
    render(<Dashboard />);

    expect(screen.getByText(/initialize your treasury/i)).toBeInTheDocument();
    expect(screen.getByText(/deploy autonomous ai agents/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create treasury vault/i, hidden: true })
    ).toBeInTheDocument();
    expect(screen.queryByText("Treasury Balance")).not.toBeInTheDocument();
  });

  it("renders all dashboard sections when an active vault exists", () => {
    trpcMock.m.vaultGetAll.mockReturnValue({ data: [activeVault] });
    trpcMock.m.vaultGetLiveData.mockReturnValue({
      data: { balance: "250000000", totalDeposits: "100000000", totalYield: "125000" },
    });
    trpcMock.m.agentGetAll.mockReturnValue({ data: [] });
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: { healthy: true, riskScore: "25" } });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions: [], total: 0 } });
    trpcMock.m.stats.mockReturnValue({
      data: { totalBudget: "0", totalYield: "0", activeAgents: 0, totalAgents: 6, riskScore: "0" },
    });

    render(<Dashboard />);

    expect(screen.getByText("Active Vault")).toBeInTheDocument();
    expect(screen.getByText("Swarm Active")).toBeInTheDocument();
    expect(screen.getByText("Treasury Balance")).toBeInTheDocument();
    expect(screen.getByText(/no agents active/i)).toBeInTheDocument();
    expect(screen.getAllByText("Risk Monitor").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/live transactions/i)).toBeInTheDocument();
    expect(screen.queryByText(/no active vault/i)).not.toBeInTheDocument();
  });
});
