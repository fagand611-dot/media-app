import { Component } from 'react';

// Catches render errors so a crash shows a message (and the error text, for
// bug reports) instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Tastemate crashed:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="crash">
        <h1>Something went wrong</h1>
        <p className="intro">This page hit an error. Reloading usually fixes it. If it keeps happening, send the message below to whoever runs this app.</p>
        <pre>{String(error?.stack || error).split('\n').slice(0, 6).join('\n')}</pre>
        <div className="row">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn btn-outline" onClick={() => { window.location.href = '/'; }}>Go to For You</button>
        </div>
      </div>
    );
  }
}
