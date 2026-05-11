import { useEffect, useState } from 'react';

export function Hero() {
  const [tvl, setTvl] = useState(1247830);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTvl((cur) => cur + Math.floor(Math.random() * 50));
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="hero">
      <div className="hero-grid">
        <div>
          <div className="eyebrow">
            <span className="dot" /> Pool Open · Live on Ethereum · 4,231 mates covered
          </div>
          <h1 className="hero-title">
            Park <em>Without</em>
            <br />
            Worry.
            <span className="ital">Parking insurance, on-chain.</span>
          </h1>
          <p className="hero-sub">
            Deposit <b>AUDM</b> — 80% routes to <b>USDT on AAVE</b> for yield, 20% stays as your
            instant-claim buffer. You get a <b>soulbound coverage NFT</b> and a lifetime cap that
            grows with tenure. Cop a fine? Treasury settles in seconds.
          </p>
          <div className="cta-row">
            <a href="#pool" className="btn btn-primary">
              Get Coverage →
            </a>
            <a href="#how" className="btn btn-ghost">
              How it Works
            </a>
          </div>
        </div>

        <div className="sign">
          <div className="sign-rules">
            <div>
              <span>MON–FRI</span>
              <span>8AM–6PM</span>
            </div>
            <div>
              <span>SAT</span>
              <span>8AM–12PM</span>
            </div>
            <div>
              <span>SUN</span>
              <span>FREE</span>
            </div>
          </div>
          <div className="sign-p">P</div>
          <div className="sign-rules">
            <div>
              <span>1 HR · TICKET</span>
              <span>$2.50/hr</span>
            </div>
            <div>
              <span>FAIRGO COVERED</span>
              <span>YES ✓</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ticker">
        <div>
          <div className="ticker-label">Treasury TVL</div>
          <div className="ticker-val tnum">
            {tvl.toLocaleString()}
            <span className="unit">AUDM</span>
          </div>
        </div>
        <div>
          <div className="ticker-label">Active Cover</div>
          <div className="ticker-val tnum">
            4,231<span className="unit">MATES</span>
          </div>
        </div>
        <div>
          <div className="ticker-label">Claims Paid (30d)</div>
          <div className="ticker-val tnum">
            312<span className="unit">PAID</span>
          </div>
        </div>
        <div>
          <div className="ticker-label">AAVE Yield (live)</div>
          <div className="ticker-val tnum">
            4.1<span className="unit">%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
