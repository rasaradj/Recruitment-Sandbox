import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F9F7F2] flex flex-col items-center justify-center p-8 text-center border-[8px] border-[#1A1A1A]">
          <AlertCircle className="w-16 h-16 text-[#D44D26] mb-6" />
          <h1 className="font-serif text-3xl mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>Application Error</h1>
          <p className="max-w-md text-sm mb-8 opacity-70">
            An unexpected error occurred while loading the application. This is often caused by missing environment variables or network issues.
          </p>
          <div className="p-4 bg-red-50 rounded text-left overflow-auto max-w-full text-xs mb-8 border border-red-100 font-mono text-red-800">
            {this.state.error?.name}: {this.state.error?.message}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="bg-[#1A1A1A] text-white px-8 py-3 uppercase text-[10px] font-bold tracking-widest hover:bg-zinc-800 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
