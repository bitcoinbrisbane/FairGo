import { PROPOSALS } from '../data';

export function Governance() {
  return (
    <section id="governance">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">05 · The DAO</div>
            <h2>
              Holders set the rules.
              <br />
              <span className="it">Even the cheeky ones.</span>
            </h2>
          </div>
          <div className="lede">
            FAIRGO is governed by AUDM depositors weighted by stake-time. Vote on parameters, fraud
            disputes, and treasury allocation.
          </div>
        </div>

        <div className="gov-grid">
          {PROPOSALS.map((p) => {
            const noPct = 100 - p.yesPct;
            const isExecuted = p.govId.includes('Executed');
            return (
              <div key={p.govId} className="gov-card">
                <h3>{p.title}</h3>
                <div className="gov-id">{p.govId}</div>
                <p>{p.body}</p>
                <div className="vote-bar">
                  <div className="vote-yes" style={{ width: `${p.yesPct}%` }} />
                  <div className="vote-no" style={{ width: `${noPct}%` }} />
                </div>
                <div className="vote-meta">
                  <span className="vote-yes-text">{p.yesLabel}</span>
                  {isExecuted ? (
                    <span style={{ color: 'var(--ink-soft)' }}>{p.noLabel}</span>
                  ) : (
                    <span className="vote-no-text">{p.noLabel}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
