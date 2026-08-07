import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WalletConnect } from "./wallet-connect";

const mockAddress = "0x" + "a".repeat(40);

function createMockEthereum() {
  return {
    request: vi.fn().mockImplementation(({ method }: { method: string }) => {
      if (method === "eth_requestAccounts") return Promise.resolve([mockAddress]);
      if (method === "eth_chainId") return Promise.resolve("0x4D1E42");
      if (method === "wallet_switchEthereumChain") return Promise.resolve(null);
      if (method === "wallet_addEthereumChain") return Promise.resolve(null);
      return Promise.resolve(null);
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
    isMetaMask: true,
  };
}

describe("WalletConnect", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    (window as any).ethereum = undefined;
  });

  it("renders a Connect Wallet button when no address is connected", () => {
    render(<WalletConnect />);
    expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
  });

  it("connects via MetaMask and shows address", async () => {
    const mock = createMockEthereum();
    (window as any).ethereum = mock;
    const user = userEvent.setup();
    render(<WalletConnect />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/aaaa\.\.\.aaaa/)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(localStorage.getItem("arcswarm_wallet")).toBe(mockAddress);
  });

  it("shows alert when MetaMask is not installed", async () => {
    (window as any).ethereum = undefined;
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<WalletConnect />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(alertSpy).toHaveBeenCalledWith("Please install MetaMask to connect your wallet");
  });

  it("disconnects and clears the stored address", async () => {
    const mock = createMockEthereum();
    (window as any).ethereum = mock;
    const user = userEvent.setup();
    render(<WalletConnect />);

    await user.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => expect(screen.getByText(/aaaa\.\.\.aaaa/)).toBeInTheDocument(), { timeout: 5000 });

    const disconnectBtn = screen.getByRole("button", { name: "" });
    await user.click(disconnectBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /connect wallet/i })).toBeInTheDocument();
    });
    expect(localStorage.getItem("arcswarm_wallet")).toBeNull();
  });
});
