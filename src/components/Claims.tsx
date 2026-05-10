import { CLAIMS, type ClaimStatus } from '../data';

const statusClass: Record<ClaimStatus, string> = {
  paid: 'status-paid',
  approved: 'status-approved',
  voting: 'status-voting',
  rejected: 'status-rejected',
};

export function Claims() {
  return (
    <section id="claims">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">03 · Transparency</div>
            <h2>
              Live claims feed.
              <br />
              <span className="it">Every payout, on-chain.</span>
            </h2>
          </div>
          <div className="lede">
            Each claim is verifiable on the explorer. Voters can dispute up to 24h after
            auto-approval. Fraud penalties slash the submitter's stake.
          </div>
        </div>

        <div className="claims-table">
          <div className="claims-row claims-head">
            <div>CLAIM ID</div>
            <div>LOCATION</div>
            <div>OFFENCE</div>
            <div>AMOUNT</div>
            <div>STATUS</div>
            <div>WHEN</div>
          </div>
          {CLAIMS.map((c) => (
            <div key={c.id} className="claims-row">
              <div className="claim-id">{c.id}</div>
              <div className="claim-loc">{c.location}</div>
              <div className="claim-fine">{c.offence}</div>
              <div className="claim-amt">{c.amount.toFixed(2)}</div>
              <div className={`claim-status ${statusClass[c.status]}`}>{c.statusLabel}</div>
              <div className="claim-when">{c.when}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
