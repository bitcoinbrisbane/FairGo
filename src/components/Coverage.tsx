import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { TIERS, type TierId } from "../data";

const TVL = 1247830;
const TOKENS = ["AUDM", "USDT", "USDC"] as const;
type Token = (typeof TOKENS)[number];

export function Coverage() {
  const { address, isConnected } = useAccount();
  const [tierId, setTierId] = useState<TierId>("standard");
  const [amount, setAmount] = useState<number>(120);
  const [token, setToken] = useState<Token>("AUDM");

  const tier = useMemo(() => TIERS.find((t) => t.id === tierId)!, [tierId]);
  const sharePct = ((amount / TVL) * 100).toFixed(4);
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "0x8a4f…dE12";

  const insufficient = amount < tier.price;
  const ctaLabel = insufficient
    ? `Need ${(tier.price - amount).toFixed(0)} more ${token}`
    : "Deposit & Activate Cover";

  const onTier = (t: TierId) => {
    const next = TIERS.find((x) => x.id === t)!;
    setTierId(t);
    setAmount(next.price);
  };

  const onDeposit = () => {
    if (!isConnected) {
      alert("Connect your wallet first.");
      return;
    }
    const swapNote = token === "AUDM" ? "" : ` Will auto-swap ${token} → AUDM via Uniswap.`;
    alert(`Approve ${token} in your wallet to continue.${swapNote} (demo)`);
  };

  return (
    <section id="pool">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">01 · The Pool</div>
            <h2>
              Pick your tier.
              <br />
              <span className="it">Slide your AUDM in.</span>
            </h2>
          </div>
          <div className="lede">
            Coverage is monthly, non-custodial, and revocable. Withdraw your stake any time you
            don't have an active claim.
          </div>
        </div>

        <div className="coverage-grid">
          <div className="coverage-left">
            <div className="tier-row">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tier${tierId === t.id ? ' active' : ''}`}
                  onClick={() => onTier(t.id)}
                >
                  <div className="tier-name">{t.name}</div>
                  <div className="tier-price">{t.price} AUDM / mo</div>
                  <div className="tier-meta">{t.meta}</div>
                </button>
              ))}
            </div>

            <div className="deposit-block">
              <div className="deposit-row">
                <span className="deposit-label">Deposit Amount</span>
                <span className="deposit-label">
                  Balance: <span className="tnum">2,450.00 {token}</span>
                </span>
              </div>
              <div className="deposit-input">
                <input
                  type="number"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                />
                <select
                  className="denom denom-select"
                  value={token}
                  onChange={(e) => setToken(e.target.value as Token)}
                >
                  {TOKENS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              {token !== "AUDM" && (
                <div className="swap-note">↳ {token} auto-swaps to AUDM via Uniswap on deposit.</div>
              )}
              <div className="breakdown">
                <div>
                  <span>Selected Tier</span>
                  <span>{tier.name}</span>
                </div>
                <div>
                  <span>Premium / month</span>
                  <span className="tnum">{tier.price.toFixed(2)} AUDM</span>
                </div>
                <div>
                  <span>Coverage Cap / month</span>
                  <span className="tnum">{tier.cap.toFixed(2)} AUDM</span>
                </div>
                <div>
                  <span>Pool Share Estimate</span>
                  <span className="tnum">{sharePct} %</span>
                </div>
                <div>
                  <span>Lock Period</span>
                  <span>30 days</span>
                </div>
                <div className="total">
                  <span>You Stake</span>
                  <span className="tnum">{amount.toFixed(2)} AUDM</span>
                </div>
              </div>
              <button
                type="button"
                className="deposit-cta"
                disabled={insufficient}
                onClick={onDeposit}
              >
                {ctaLabel}
              </button>
            </div>
          </div>

          <div className="coverage-right">
            <div className="id-card">
              <div className="id-card-stamp">{isConnected ? 'ACTIVE' : 'PREVIEW'}</div>
              <div className="id-card-top">
                <div>
                  <div className="label">Member ID</div>
                  <div className="id-card-name">#1</div>
                </div>
                <div className="id-card-tier-badge">{tier.name} · #3,142</div>
              </div>
              <div className="id-card-meta">
                <div>
                  VEHICLE
                  <br />
                  <strong className="mono">0x4f2e…9b3c</strong>
                </div>
                <div>
                  RENEWS
                  <br />
                  <strong>Jun 09 · Auto</strong>
                </div>
                <div>
                  WALLET
                  <br />
                  <strong className="mono">{shortAddr}</strong>
                </div>
                <div>
                  CLAIMS USED
                  <br />
                  <strong>0 / {tier.cap} AUDM</strong>
                </div>
              </div>
            </div>

            <div className="pool-stats">
              <div className="pool-stat">
                <div className="ticker-label">Your Premium APR</div>
                <div className="ticker-val tnum">
                  12.4<span className="unit">%</span>
                </div>
              </div>
              <div className="pool-stat">
                <div className="ticker-label">Pool Yield (Aave)</div>
                <div className="ticker-val tnum">
                  3.8<span className="unit">%</span>
                </div>
              </div>
              <div className="pool-stat">
                <div className="ticker-label">Days Covered</div>
                <div className="ticker-val tnum">
                  87<span className="unit">D</span>
                </div>
              </div>
              <div className="pool-stat">
                <div className="ticker-label">Next Vote Weight</div>
                <div className="ticker-val tnum">
                  1.18<span className="unit">×</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
