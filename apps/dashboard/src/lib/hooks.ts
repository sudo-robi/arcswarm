import { useState, useEffect, useCallback, useRef } from 'react'
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

export function useVaultData(intervalMs = 30000, initialDelayMs = 3000) {
  const [data, setData] = useState<VaultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const vault = await fetchVaultData()
      if (mounted.current) setData(vault)
      setError(null)
    } catch (e: any) {
      if (mounted.current) setError(e.message ?? 'Failed to fetch vault data')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = setTimeout(refresh, initialDelayMs)
    const id = setInterval(refresh, intervalMs)
    return () => { mounted.current = false; clearTimeout(timer); clearInterval(id) }
  }, [refresh, intervalMs, initialDelayMs])

  return { data, loading, error, refresh }
}

export function useAgentInfos(intervalMs = 30000, initialDelayMs = 10000) {
  const [data, setData] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const agents = await fetchAgentInfos()
      if (mounted.current) setData(agents)
      setError(null)
    } catch (e: any) {
      if (mounted.current) setError(e.message ?? 'Failed to fetch agents')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = setTimeout(refresh, initialDelayMs)
    const id = setInterval(refresh, intervalMs)
    return () => { mounted.current = false; clearTimeout(timer); clearInterval(id) }
  }, [refresh, intervalMs, initialDelayMs])

  return { data, loading, error, refresh }
}

export function useRiskMetrics(intervalMs = 30000, initialDelayMs = 20000) {
  const [data, setData] = useState<RiskMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const risk = await fetchRiskMetrics()
      if (mounted.current) setData(risk)
      setError(null)
    } catch (e: any) {
      if (mounted.current) setError(e.message ?? 'Failed to fetch risk metrics')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = setTimeout(refresh, initialDelayMs)
    const id = setInterval(refresh, intervalMs)
    return () => { mounted.current = false; clearTimeout(timer); clearInterval(id) }
  }, [refresh, intervalMs, initialDelayMs])

  return { data, loading, error, refresh }
}

export function usePaymentStats(intervalMs = 30000, initialDelayMs = 30000) {
  const [data, setData] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const stats = await fetchPaymentStats()
      if (mounted.current) setData(stats)
      setError(null)
    } catch (e: any) {
      if (mounted.current) setError(e.message ?? 'Failed to fetch payment stats')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const timer = setTimeout(refresh, initialDelayMs)
    const id = setInterval(refresh, intervalMs)
    return () => { mounted.current = false; clearTimeout(timer); clearInterval(id) }
  }, [refresh, intervalMs, initialDelayMs])

  return { data, loading, error, refresh }
}
