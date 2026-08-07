import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskPanel } from "./risk-panel";

const trpcMock = vi.hoisted(() => {
  const m = {
    riskGetLiveScore: vi.fn(),
    riskGetAlerts: vi.fn(),
  };
  return {
    m,
    trpc: {
      risk: {
        getLiveScore: { useQuery: m.riskGetLiveScore },
        getAlerts: { useQuery: m.riskGetAlerts },
      },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcMock.trpc }));

const alerts = [
  { id: "r1", severity: "HIGH", message: "Exposure limit breached", createdAt: "2026-01-01T10:00:00Z" },
  { id: "r2", severity: "LOW", message: "Minor slippage detected", createdAt: "2026-01-01T11:00:00Z" },
];

describe("RiskPanel", () => {
  beforeEach(() => {
    trpcMock.m.riskGetLiveScore.mockReset();
    trpcMock.m.riskGetAlerts.mockReset();
  });

  it("renders the Risk Monitor title", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: undefined });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId="v1" />);
    expect(screen.getByRole("heading", { name: /risk monitor/i })).toBeInTheDocument();
  });

  it("shows a healthy system state", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: { healthy: true, riskScore: "25" } });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId="v1" />);

    expect(screen.getByText(/all systems operational/i)).toBeInTheDocument();
    expect(screen.getByText("25/100")).toBeInTheDocument();
    expect(screen.getByText("SAFE")).toBeInTheDocument();
    expect(screen.queryByText("WARNING")).not.toBeInTheDocument();
  });

  it("shows a warning state when unhealthy", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: { healthy: false, riskScore: "85" } });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId="v1" />);

    expect(screen.getByText(/issues detected/i)).toBeInTheDocument();
    expect(screen.getByText("85/100")).toBeInTheDocument();
    expect(screen.getByText("WARNING")).toBeInTheDocument();
  });

  it("defaults to a healthy state and 0 score when no live data is available", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: undefined });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId="v1" />);

    expect(screen.getByText(/all systems operational/i)).toBeInTheDocument();
    expect(screen.getByText("0/100")).toBeInTheDocument();
    expect(screen.getByText("SAFE")).toBeInTheDocument();
    expect(screen.queryByText("WARNING")).not.toBeInTheDocument();
  });

  it("renders severity badges and alert messages", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: { healthy: true, riskScore: "10" } });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: alerts });
    render(<RiskPanel vaultId="v1" />);

    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("LOW")).toBeInTheDocument();
    expect(screen.getByText(/exposure limit breached/i)).toBeInTheDocument();
    expect(screen.getByText(/minor slippage detected/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no alerts", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: undefined });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId="v1" />);
    expect(screen.getByText(/no active alerts/i)).toBeInTheDocument();
  });

  it("only renders the first five alerts", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: `r${i}`,
      severity: "CRITICAL",
      message: `Alert number ${i}`,
      createdAt: new Date(0).toISOString(),
    }));
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: undefined });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: many });
    render(<RiskPanel vaultId="v1" />);

    expect(screen.getByText("Alert number 0")).toBeInTheDocument();
    expect(screen.getByText("Alert number 4")).toBeInTheDocument();
    expect(screen.queryByText("Alert number 5")).not.toBeInTheDocument();
    expect(screen.queryByText("Alert number 6")).not.toBeInTheDocument();
  });

  it("calls the live score query regardless of vaultId", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: undefined });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId={null} />);
    expect(trpcMock.m.riskGetLiveScore).toHaveBeenCalledWith(
      { riskOracleAddress: "0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd" },
      expect.objectContaining({ refetchInterval: 10000 })
    );
  });

  it("disables the alerts query when no vaultId is provided", () => {
    trpcMock.m.riskGetLiveScore.mockReturnValue({ data: undefined });
    trpcMock.m.riskGetAlerts.mockReturnValue({ data: [] });
    render(<RiskPanel vaultId={null} />);
    expect(trpcMock.m.riskGetAlerts).toHaveBeenCalledWith(
      { vaultId: "" },
      expect.objectContaining({ enabled: false, refetchInterval: 10000 })
    );
  });
});
