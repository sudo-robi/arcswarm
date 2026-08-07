import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionFeed } from "./transaction-feed";

const trpcMock = vi.hoisted(() => {
  const m = {
    transactionGetAll: vi.fn(),
  };
  return {
    m,
    trpc: {
      transaction: { getAll: { useQuery: m.transactionGetAll } },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcMock.trpc }));

const transactions = [
  {
    id: "t1",
    type: "DEPOSIT",
    amount: 1000000n,
    memo: "Initial deposit",
    fromAddress: "0x1111111111",
    toAddress: "0x2222222222",
    txHash: "0xabc1234567",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "t2",
    type: "YIELD_HARVEST",
    amount: 2500000n,
    memo: null,
    fromAddress: "0x3333333333",
    toAddress: "0x4444444444",
    txHash: null,
    createdAt: "2024-01-15T11:00:00Z",
  },
];

describe("TransactionFeed", () => {
  beforeEach(() => {
    trpcMock.m.transactionGetAll.mockReset();
  });

  it("shows an empty state when there are no transactions", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions: [], total: 0 } });
    render(<TransactionFeed vaultId="v1" />);
    expect(screen.getByText(/no transactions yet/i)).toBeInTheDocument();
  });

  it("renders the Live Transactions title and auto-refresh badge", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions: [], total: 0 } });
    render(<TransactionFeed vaultId="v1" />);
    expect(screen.getByRole("heading", { name: /live transactions/i })).toBeInTheDocument();
    expect(screen.getByText(/auto-refresh/i)).toBeInTheDocument();
  });

  it("disables the query when no vaultId is provided", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: undefined });
    render(<TransactionFeed vaultId={null} />);
    expect(trpcMock.m.transactionGetAll).toHaveBeenCalledWith(
      { vaultId: "", limit: 20 },
      expect.objectContaining({ enabled: false, refetchInterval: 10000 })
    );
  });

  it("formats the transaction type label", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions, total: 2 } });
    render(<TransactionFeed vaultId="v1" />);
    expect(screen.getByText("deposit")).toBeInTheDocument();
    expect(screen.getByText("yield harvest")).toBeInTheDocument();
  });

  it("formats the amount with prefix", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions, total: 2 } });
    render(<TransactionFeed vaultId="v1" />);
    // Deposit gets + prefix, yield harvest gets + prefix
    expect(screen.getByText("+$1.00")).toBeInTheDocument();
    expect(screen.getByText("+$2.50")).toBeInTheDocument();
  });

  it("shows the memo when present and an address pair when absent", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions, total: 2 } });
    render(<TransactionFeed vaultId="v1" />);

    expect(screen.getByText(/initial deposit/i)).toBeInTheDocument();
    expect(screen.getByText("0x3333... → 0x4444...")).toBeInTheDocument();
  });

  it("renders an icon per transaction", () => {
    trpcMock.m.transactionGetAll.mockReturnValue({ data: { transactions, total: 2 } });
    const { container } = render(<TransactionFeed vaultId="v1" />);
    // Each transaction has an icon + clock icon = 2 SVGs per transaction
    expect(container.querySelectorAll("svg")).toHaveLength(transactions.length * 2);
  });
});
