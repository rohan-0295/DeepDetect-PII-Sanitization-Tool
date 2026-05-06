import React from 'react';
import { Shield, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // In production you'd send this to Sentry / Datadog etc.
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="w-full max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-950/50 border border-red-900/60 flex items-center justify-center mx-auto mb-5">
              <Shield size={22} className="text-red-400" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100 mb-2">Something went wrong</h1>
            <p className="text-sm text-zinc-500 mb-6">
              An unexpected error occurred. Your data and session are safe.
            </p>
            {process.env.NODE_ENV !== 'production' && (
              <div className="text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6">
                <p className="text-xs font-mono text-red-400 mb-1">{this.state.error?.toString()}</p>
                <pre className="text-xs font-mono text-zinc-600 whitespace-pre-wrap overflow-auto max-h-36">
                  {this.state.info?.componentStack}
                </pre>
              </div>
            )}
            <button onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
              <RefreshCw size={15} strokeWidth={2.5} />
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
