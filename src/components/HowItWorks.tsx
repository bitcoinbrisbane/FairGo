const STEPS = [
  {
    n: '01',
    title: 'DEPOSIT',
    body:
      'Stake AUDM into the FAIRGO pool contract. Receive a soulbound coverage NFT proving your tier & vehicle plate.',
  },
  {
    n: '02',
    title: 'PARK',
    body:
      "Live your life. Loading zones, expired meters, the lot. All within your tier limits. We won't judge.",
  },
  {
    n: '03',
    title: 'SUBMIT',
    body:
      'Cop a fine? Snap it & submit. The infringement ID is verified against state council APIs. Auto-approved if it matches.',
  },
  {
    n: "04",
    title: "PAID",
    body:
      "The DAO pays the council in real AUD on your behalf. No crypto in the council's hands. Just a fiat settlement to the issuing authority, lodged against your claim on-chain.",
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">02 · The Mechanism</div>
            <h2>
              Four steps.
              <br />
              <span className="it">No paperwork.</span>
            </h2>
          </div>
          <div className="lede">
            Premiums sit in an audited contract earning yield. Approved claims pay out from the
            same pool. Surplus flows to depositors quarterly.
          </div>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.n} className="step">
              <div className="step-num">{s.n}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-body">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
