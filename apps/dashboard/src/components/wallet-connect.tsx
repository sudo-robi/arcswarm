'use client'

import { useState, useEffect } from 'react'
import { Wallet, LogOut, Loader2, ExternalLink } from 'lucide-react'
import { ethers } from 'ethers'

const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: '0x4D1E42',
  rpcUrl: 'https://rpc.testnet.arc.network',
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://testnet.arc.network'],
}

export function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [wrongNetwork, setWrongNetwork] = useState(false)
  const [balance, setBalance] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('arcswarm_wallet')
    if (saved) {
      setAddress(saved)
      fetchBalance(saved)
    }

    const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined
    if (ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          handleDisconnect()
        } else if (accounts[0] !== address) {
          setAddress(accounts[0])
          localStorage.setItem('arcswarm_wallet', accounts[0])
          fetchBalance(accounts[0])
        }
      }

      const handleChainChanged = (chainId: string) => {
        setWrongNetwork(chainId !== ARC_TESTNET.chainIdHex)
      }

      ethereum.on('accountsChanged', handleAccountsChanged)
      ethereum.on('chainChanged', handleChainChanged)

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged)
        ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  const fetchBalance = async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl)
      const bal = await provider.getBalance(addr)
      setBalance(ethers.formatEther(bal))
    } catch (e) {
      // Balance fetch failed, non-critical
    }
  }

  const switchToArc = async () => {
    const ethereum = window.ethereum
    if (!ethereum) return
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_TESTNET.chainIdHex }],
      })
      setWrongNetwork(false)
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: ARC_TESTNET.chainIdHex,
              chainName: ARC_TESTNET.chainName,
              rpcUrls: [ARC_TESTNET.rpcUrl],
              nativeCurrency: ARC_TESTNET.nativeCurrency,
              blockExplorerUrls: ARC_TESTNET.blockExplorerUrls,
            },
          ],
        })
        setWrongNetwork(false)
      }
    }
  }

  const handleConnect = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask to connect your wallet')
      return
    }
    setConnecting(true)
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[]
      const addr = accounts[0]

      const chainId = await window.ethereum.request({ method: 'eth_chainId' }) as string
      if (chainId !== ARC_TESTNET.chainIdHex) {
        setWrongNetwork(true)
        await switchToArc()
      }

      setAddress(addr)
      localStorage.setItem('arcswarm_wallet', addr)
      await fetchBalance(addr)
    } catch (err) {
      console.error('Failed to connect wallet:', err)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    setAddress(null)
    setBalance(null)
    setWrongNetwork(false)
    localStorage.removeItem('arcswarm_wallet')
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        {wrongNetwork && (
          <button
            onClick={switchToArc}
            className="px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-medium hover:bg-orange-500/20 transition-colors"
          >
            Switch to Arc
          </button>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border">
          <div className={`w-2 h-2 rounded-full ${wrongNetwork ? 'bg-orange-500' : 'bg-emerald-500'}`} />
          <span className="text-sm font-mono">{address.slice(0, 6)}...{address.slice(-4)}</span>
          {balance && (
            <span className="text-xs text-muted-foreground ml-1">{Number(balance).toFixed(4)} ETH</span>
          )}
        </div>
        <a
          href={`https://testnet.arc.network/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={handleDisconnect}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-cyan-500 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {connecting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4" />
      )}
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}
