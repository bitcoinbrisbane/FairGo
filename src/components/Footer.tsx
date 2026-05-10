export function Footer() {
  return (
    <footer id="docs">
      <div className="footer-grid">
        <div>
          <div className="foot-brand">FAIRGO</div>
          <div className="foot-tag">Parking insurance, on-chain. Fair dinkum.</div>
        </div>
        <div>
          <h4>Protocol</h4>
          <ul>
            <li><a href="#">Pool Contract</a></li>
            <li><a href="#">Oracle Spec</a></li>
            <li><a href="#">AUDM Token</a></li>
            <li><a href="#">Audits (Trail of Bits)</a></li>
          </ul>
        </div>
        <div>
          <h4>Use</h4>
          <ul>
            <li><a href="#pool">Get Cover</a></li>
            <li><a href="#submit">Lodge a Claim</a></li>
            <li><a href="#governance">Vote</a></li>
            <li><a href="#">Bridge AUDM</a></li>
          </ul>
        </div>
        <div>
          <h4>Mates</h4>
          <ul>
            <li><a href="#">Discord</a></li>
            <li><a href="#">Mirror</a></li>
            <li><a href="#">GitHub</a></li>
            <li><a href="#">Press</a></li>
          </ul>
        </div>
      </div>
      <div className="legal">
        <div>FAIRGO LABS PTY LTD · ABN 22 482 991 003 · BRISBANE QLD</div>
        <div>NOT LEGAL OR FINANCIAL ADVICE · COVERAGE SUBJECT TO POOL TERMS · REPENT-FREE ZONE</div>
      </div>
    </footer>
  );
}
