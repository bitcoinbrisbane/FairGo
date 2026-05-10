import { useAccount, useConnect, useDisconnect } from 'wagmi';

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Header() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const onClick = () => {
    if (isConnected) {
      disconnect();
      return;
    }
    const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0];
    if (injected) connect({ connector: injected });
  };

  const label = isConnected && address
    ? shortAddress(address)
    : isPending
      ? 'Connecting…'
      : 'Connect Wallet';

  return (
    <header className="bar">
      <div className="brand">
        <div className="p-mark">P</div>
        FAIRGO
        <small>v0.0.1 · base</small>
      </div>
      <nav className="primary">
        <a href="#pool">Pool</a>
        <a href="#claims">Claims</a>
        <a href="#submit">Submit</a>
        <a href="#governance">Governance</a>
        <a href="#docs">Docs</a>
      </nav>
      <button
        className={`wallet-btn${isConnected ? ' connected' : ''}`}
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    </header>
  );
}
