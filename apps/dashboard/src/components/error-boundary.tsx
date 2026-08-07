import React from 'react'
import * as Sentry from '@sentry/react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-md shadow-2xl text-center space-y-6">
        <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-red-950/50 border border-red-500/30 text-red-500 animate-pulse">
          <AlertTriangle className="h-8 w-8" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">System Encountered an Error</h2>
          <p className="text-sm text-slate-400">
            The error has been logged to our security operations center. Please try reloading the system.
          </p>
        </div>

        {error.message && (
          <div className="p-3 text-left rounded-lg bg-slate-950/80 border border-slate-800/80 font-mono text-xs text-red-400 overflow-x-auto max-h-32">
            {error.message}
          </div>
        )}

        <Button
          onClick={resetErrorBoundary}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg hover:shadow-indigo-500/20 transition-all duration-200"
          size="lg"
        >
          <RefreshCw className="mr-2 h-4 w-4 animate-spin-slow" />
          Reload Swarm Dashboard
        </Button>
      </div>
    </div>
  )
}

export function SwarmErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetErrorBoundary={resetError} />
      )}
      onReset={() => {
        window.location.reload()
      }}
      onError={(error, componentStack) => {
        console.error('Captured dashboard render error:', error, componentStack)
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}
