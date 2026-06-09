'use client'
import React from 'react'

interface State { error: Error | null }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#fdf5f3' }}>
          <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl w-full border-2" style={{ borderColor: '#e4b5ad' }}>
            <h1 className="text-xl font-bold mb-2" style={{ color: '#7B2820' }}>Erreur détectée</h1>
            <p className="text-sm text-gray-500 mb-4">Copiez ce message et envoyez-le pour corriger le problème :</p>
            <pre className="bg-gray-50 rounded-xl p-4 text-xs overflow-auto max-h-64 border border-gray-200 text-red-700 whitespace-pre-wrap">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: '#7B2820' }}
            >
              Recharger la page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
