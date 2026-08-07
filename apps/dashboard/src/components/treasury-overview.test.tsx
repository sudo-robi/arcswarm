import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TreasuryOverview } from "./treasury-overview";

const trpcMock = vi.hoisted(() => {
  const m = {
    vaultGetLiveData: vi.fn(),
    stats: vi.fn(),
  };
  return {
    m,
    trpc: {
      vault: { getLiveData: { useQuery: m.vaultGetLiveData } },
      stats: { useQuery: m.stats },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcMock.trpc }));

describe("TreasuryOverview", () => {
  beforeEach(() => {
    trpcMock.m.vaultGetLiveData.mockReset();
    trpcMock.m.stats.mockReset();
  });

  it("renders all four metric labels", () => {
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    render(<TreasuryOverview vaultId="v1" />);

    expect(screen.getByText("Vault Balance")).toBeInTheDocument();
    expect(screen.getByText("Total Deposits")).toBeInTheDocument();
    expect(screen.getByText("Total Yield")).toBeInTheDocument();
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
  });

  it("shows zero values when no vault data is available", () => {
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    render(<TreasuryOverview vaultId="v1" />);

    expect(screen.getByText("0/6")).toBeInTheDocument();
    // $0.00 appears in change indicators and values, so use getAllByText
    expect(screen.getAllByText("$0.00").length).toBeGreaterThanOrEqual(2);
  });

  it("formats vault balances, deposits, and yield from live data", () => {
    trpcMock.m.vaultGetLiveData.mockReturnValue({
      data: { balance: "250000000", totalDeposits: "100000000", totalYield: "125000" },
    });
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    render(<TreasuryOverview vaultId="v1" />);

    expect(screen.getByText("$250.00")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$0.1250")).toBeInTheDocument();
    expect(screen.getByText("0/6")).toBeInTheDocument();
  });

  it("renders active agent counts from stats", () => {
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    trpcMock.m.stats.mockReturnValue({ data: { activeAgents: 4, totalAgents: 6 } });
    render(<TreasuryOverview vaultId="v1" />);

    expect(screen.getByText("4/6")).toBeInTheDocument();
  });

  it("disables the stats query when no vaultId is provided", () => {
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    render(<TreasuryOverview vaultId={null} />);

    expect(trpcMock.m.vaultGetLiveData).toHaveBeenCalledWith(
      { vaultAddress: "0x86014c6473574F93d4BFc386541681f8c1200160" },
      expect.objectContaining({ refetchInterval: 10000 })
    );
    expect(trpcMock.m.stats).toHaveBeenCalledWith(
      { vaultId: "" },
      expect.objectContaining({ enabled: false, refetchInterval: 10000 })
    );
  });
});
