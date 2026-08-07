import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsCards } from "./stats-cards";

const trpcMock = vi.hoisted(() => {
  const m = {
    stats: vi.fn(),
    vaultGetLiveData: vi.fn(),
  };
  return {
    m,
    trpc: {
      stats: { useQuery: m.stats },
      vault: { getLiveData: { useQuery: m.vaultGetLiveData } },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcMock.trpc }));

describe("StatsCards", () => {
  beforeEach(() => {
    trpcMock.m.stats.mockReset();
    trpcMock.m.vaultGetLiveData.mockReset();
  });

  it("renders all four stat labels", () => {
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    render(<StatsCards vaultId="v1" />);

    expect(screen.getByText("Treasury Balance")).toBeInTheDocument();
    expect(screen.getByText("Total Yield Earned")).toBeInTheDocument();
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(screen.getByText("Risk Score")).toBeInTheDocument();
  });

  it("shows zeroed defaults when no data is available", () => {
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    render(<StatsCards vaultId="v1" />);

    // Value and "USDC" are separate spans
    expect(screen.getAllByText("$0")).toHaveLength(2);
    expect(screen.getByText("0/6")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("prefers live vault balance over the stats budget", () => {
    trpcMock.m.stats.mockReturnValue({ data: { totalBudget: "10000000" } });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: { balance: "250000000" } });
    render(<StatsCards vaultId="v1" />);

    expect(screen.getByText("$250")).toBeInTheDocument();
  });

  it("falls back to stats totalBudget when live balance is missing", () => {
    trpcMock.m.stats.mockReturnValue({ data: { totalBudget: "5000000" } });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    render(<StatsCards vaultId="v1" />);

    expect(screen.getByText("$5")).toBeInTheDocument();
  });

  it("formats yield, agent counts, and risk score from stats", () => {
    trpcMock.m.stats.mockReturnValue({
      data: { totalYield: "1000000", activeAgents: 3, totalAgents: 6, riskScore: "42" },
    });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    render(<StatsCards vaultId="v1" />);

    expect(screen.getByText("$1")).toBeInTheDocument();
    expect(screen.getByText("3/6")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("uses the locale grouping for larger amounts", () => {
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: { balance: "1234567890" } });
    render(<StatsCards vaultId="v1" />);

    expect(screen.getByText("$1,234.568")).toBeInTheDocument();
  });

  it("calls both queries with expected inputs", () => {
    trpcMock.m.stats.mockReturnValue({ data: undefined });
    trpcMock.m.vaultGetLiveData.mockReturnValue({ data: undefined });
    render(<StatsCards vaultId={null} />);

    expect(trpcMock.m.stats).toHaveBeenCalledWith(
      { vaultId: "" },
      expect.objectContaining({ enabled: false, refetchInterval: 10000 })
    );
    expect(trpcMock.m.vaultGetLiveData).toHaveBeenCalledWith(
      { vaultAddress: "0x86014c6473574F93d4BFc386541681f8c1200160" },
      expect.objectContaining({ refetchInterval: 5000 })
    );
  });
});
