/**
 * SSEM: Resilience — catches unhandled render errors and presents a safe
 * degraded UI without leaking stack traces to the user.
 */

import React, { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // In production, send to error tracking (Sentry, etc.)
    // Never log sensitive data or user input
    console.error('[ErrorBoundary]', error.name, error.message.slice(0, 100));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Something went wrong</h2>
            <p className="text-gray-500 mb-4">Please reload the page or contact support.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-brand-600 text-white px-4 py-2 rounded hover:bg-brand-700"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
