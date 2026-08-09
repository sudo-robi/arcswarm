import { useState, useEffect, useCallback } from 'react'
import {
  fetchVaultData,
  fetchAgentInfos,
  fetchRiskMetrics,
  fetchPaymentStats,
  type VaultData,
  type AgentInfo,
  type RiskMetrics,
  type PaymentStats,
} from './contracts'

export function useVaultData(intervalMs = 5000) {
  const [data, setData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const vault = await fetchVaultData()
      setData(vault)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch vault data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}

export function useAgentInfos(intervalMs = 10000) {
  const [data, setData] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const agents = await fetchAgentInfos()
      setData(agents)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}

export function useRiskMetrics(intervalMs = 10000) {
  const [data, setData] = useState<RiskMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const risk = await fetchRiskMetrics()
      setData(risk)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch risk metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}

export function usePaymentStats(intervalMs = 10000) {
  const [data, setData] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const stats = await fetchPaymentStats()
      setData(stats)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to fetch payment stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, intervalMs)
    return () => clearInterval(id)
  }, [refresh, intervalMs])

  return { data, loading, error, refresh }
}
