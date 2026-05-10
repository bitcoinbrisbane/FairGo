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
            <span className="dot" /> Pool Open · Live on Base · 4,231 mates covered
          </div>
          <h1 className="hero-title">
            Park <em>Without</em>
            <br />
            Worry.
            <span className="ital">Parking insurance, on-chain.</span>
          </h1>
          <p className="hero-sub">
            Deposit <b>AUDM</b> or <b>USDC/USDT</b>. Cop a fine? The <b>FAIRGO Treasury</b>{" "}
            reimburses you on-chain. Verified by holders, paid in seconds. Council can keep the
            meter running. We've got your back.
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
          <div className="sign-p" aria-label="Kangaroo">
            <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true">
              <path d="M192 50c-5-6-12-8-20-7l-2-12h-4l1 13-9-13h-4l2 13c-9 2-16-1-24-8-16-12-40-14-56-6-10 5-16 14-16 24-10 6-22 16-34 30-8 8-14 16-14 18l10 6c6-8 16-16 28-24 14-8 28-12 38-12h12c6 4 12 12 14 22l-4 8-10 8 30 3h30v-7l-16-4c-12-6-18-14-14-22l8-4c0 8 4 12 8 12h6v-6c2-6 6-10 10-14l12-6c8-4 14-8 18-12z"/>
            </svg>
          </div>
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
          <div className="ticker-label">Approval Rate</div>
          <div className="ticker-val tnum">
            94.2<span className="unit">%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
