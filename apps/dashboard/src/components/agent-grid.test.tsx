import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentGrid } from "./agent-grid";

const trpcMock = vi.hoisted(() => {
  const m = {
    agentGetAll: vi.fn(),
  };
  return {
    m,
    trpc: {
      agent: { getAll: { useQuery: m.agentGetAll } },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcMock.trpc }));

const agents = [
  {
    id: "a1",
    type: "YIELD",
    active: true,
    walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
    budget: 10000000n,
    spent: 2000000n,
  },
  {
    id: "a2",
    type: "PAYMENT",
    active: false,
    walletAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
    budget: 5000000n,
    spent: 5000000n,
  },
];

describe("AgentGrid", () => {
  beforeEach(() => {
    trpcMock.m.agentGetAll.mockReset();
  });

  it("shows an empty state when there are no agents", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: [] });
    render(<AgentGrid vaultId="v1" />);
    expect(screen.getByText(/no agents active/i)).toBeInTheDocument();
  });

  it("shows an empty state when the query is disabled (no vaultId)", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: undefined });
    render(<AgentGrid vaultId={null} />);
    expect(screen.getByText(/no agents active/i)).toBeInTheDocument();
  });

  it("calls the query with enabled=false when no vaultId is provided", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: undefined });
    render(<AgentGrid vaultId={null} />);
    expect(trpcMock.m.agentGetAll).toHaveBeenCalledWith(
      { vaultId: "" },
      expect.objectContaining({ enabled: false, refetchInterval: 10000 })
    );
  });

  it("calls the query with enabled=true when a vaultId is provided", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    render(<AgentGrid vaultId="v1" />);
    expect(trpcMock.m.agentGetAll).toHaveBeenCalledWith(
      { vaultId: "v1" },
      expect.objectContaining({ enabled: true, refetchInterval: 10000 })
    );
  });

  it("renders the Active Agents title", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    render(<AgentGrid vaultId="v1" />);
    expect(screen.getByRole("heading", { name: /active agents/i })).toBeInTheDocument();
  });

  it("renders agent type labels lowercased", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    render(<AgentGrid vaultId="v1" />);
    expect(screen.getByText("yield")).toBeInTheDocument();
    expect(screen.getByText("payment")).toBeInTheDocument();
  });

  it("renders active and paused badges per agent", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    render(<AgentGrid vaultId="v1" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("formats budget and spent amounts in millions", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    render(<AgentGrid vaultId="v1" />);
    expect(screen.getByText("$10.0M")).toBeInTheDocument();
    expect(screen.getByText("$2.0M")).toBeInTheDocument();
    expect(screen.getAllByText("$5.0M")).toHaveLength(2);
  });

  it("truncates the wallet address to 10 chars", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    render(<AgentGrid vaultId="v1" />);
    expect(screen.getByText("0x1234567890...")).toBeInTheDocument();
  });

  it("renders an icon per agent card", () => {
    trpcMock.m.agentGetAll.mockReturnValue({ data: agents });
    const { container } = render(<AgentGrid vaultId="v1" />);
    expect(container.querySelectorAll("svg")).toHaveLength(agents.length);
  });
});
