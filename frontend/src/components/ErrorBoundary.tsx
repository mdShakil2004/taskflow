import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Catches unexpected render/lifecycle errors so a bug in one screen doesn't
 * take down the whole app to a blank white page. Does not attempt to catch
 * or reinterpret API errors — those are handled per-request via ApiError /
 * getErrorMessage and toasts; this is strictly a last-resort fallback for
 * genuine component crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="panel p-6 max-w-sm text-center">
            <h1 className="font-display text-base font-semibold text-paper mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-paper-muted mb-4">
              This screen hit an unexpected error. Reloading usually fixes it.
            </p>
            <button className="btn-primary w-full" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
