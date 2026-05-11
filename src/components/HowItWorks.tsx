const STEPS = [
  {
    n: '01',
    title: 'DEPOSIT',
    body:
      'Stake AUDM into the FAIRGO pool. 80% auto-swaps to USDT on Uniswap V3 and is supplied to AAVE V3; 20% stays in-pool as the AUDM claim buffer. You receive a soulbound (EIP-5192) coverage NFT with your vehicle plate hashed on-chain.',
  },
  {
    n: '02',
    title: 'WAIT & EARN',
    body:
      "30-day wait period gates withdrawals and claims. AAVE yield accrues in the background, growing TVL as a solvency cushion. Your lifetime cap then unlocks and grows logarithmically with tenure: stake × 1.5 × ln(1 + months).",
  },
  {
    n: '03',
    title: 'SUBMIT',
    body:
      'Cop a fine? Snap it & submit. The infringement number is verified against state council APIs. Oracle approves on match, marks the claim ready for payout.',
  },
  {
    n: "04",
    title: "PAID",
    body:
      "Treasury pays you in AUDM straight from the buffer. If a claim is bigger than the buffer, the contract pulls just enough USDT from AAVE and swaps it back via Uniswap exactOutputSingle — no more, no less. AAVE principal stays earning.",
  },
  {
    n: "05",
    title: "HARVEST",
    body:
      "Treasury role can call harvest() at any time to skim accrued AAVE yield (aUSDT balance minus principal) without touching what backs your coverage. Principal is sacrosanct.",
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
              Five steps.
              <br />
              <span className="it">No paperwork.</span>
            </h2>
          </div>
          <div className="lede">
            Every AUDM that comes in is split 80/20 — most works for you in AAVE, the rest sits
            ready to settle the next ticket. Approved claims pay from the buffer first; the pool
            only unwinds AAVE for the shortfall.
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
