import React from 'react';
import { AlertOctagon, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      incidentId: null
    };
  }

  static getDerivedStateFromError(error) {
    return { 
      hasError: true, 
      error,
      incidentId: `TPF-ERR-${Date.now().toString(36).toUpperCase()}`
    };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Enterprise ErrorBoundary intercepted unhandled exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1c023d] flex items-center justify-center p-6 font-sans text-white">
          <div className="w-full max-w-lg bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[10px] font-black uppercase tracking-wider text-rose-300">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Central Exception Intercepted</span>
              </div>
              <h1 className="text-xl font-black text-white">Temporary Application Issue</h1>
              <p className="text-xs text-purple-200/80 leading-relaxed max-w-sm mx-auto">
                StockSentry encountered an unexpected UI rendering exception. Your underlying data and inventory transactions remain completely secure.
              </p>
            </div>

            {this.state.incidentId && (
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 text-left font-mono text-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                  <span>Incident Code:</span>
                  <span className="text-[#e20d65] font-black">{this.state.incidentId}</span>
                </div>
                {this.state.error && (
                  <p className="text-rose-300 text-[10px] truncate">
                    {this.state.error.toString()}
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold text-xs transition flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl bg-[#e20d65] hover:bg-[#c20955] text-white font-black text-xs transition shadow-lg shadow-rose-900/40 flex items-center gap-2"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reload Portal</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400">
              Tata Play Fiber Central IT Operations & NOC Support
            </p>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
