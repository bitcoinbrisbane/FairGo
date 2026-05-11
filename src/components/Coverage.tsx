import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { POOL, TENURE_PREVIEW, coverageCap } from "../data";

const TVL = 1247830;
const TOKENS = ["AUDM", "USDT", "USDC"] as const;
type Token = (typeof TOKENS)[number];

const MIN_STAKE = 25;
const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function Coverage() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState<number>(120);
  const [token, setToken] = useState<Token>("AUDM");

  const investAmount = (amount * POOL.investBps) / 10000;
  const bufferAmount = amount - investAmount;
  const sharePct = ((amount / TVL) * 100).toFixed(4);
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "0x8a4f…dE12";

  const insufficient = amount < MIN_STAKE;
  const ctaLabel = insufficient
    ? `Min stake ${MIN_STAKE} AUDM`
    : "Deposit & Mint Soulbound Cover";

  const tenureRows = useMemo(
    () => TENURE_PREVIEW.map((p) => ({ ...p, cap: coverageCap(amount, p.months) })),
    [amount]
  );
  const sampleCap12mo = coverageCap(amount, 12);

  const onDeposit = () => {
    if (!isConnected) {
      alert("Connect your wallet first.");
      return;
    }
    const swapNote = token === "AUDM" ? "" : ` Will auto-swap ${token} → AUDM via Uniswap.`;
    alert(
      `Approve ${token} to deposit ${fmt(amount)} AUDM.${swapNote}\n` +
        `→ ${fmt(investAmount)} AUDM swapped to USDT and supplied to AAVE.\n` +
        `→ ${fmt(bufferAmount)} AUDM held as the claim buffer.\n` +
        `→ Soulbound coverage NFT minted to your wallet. (demo)`
    );
  };

  return (
    <section id="pool">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">01 · The Pool</div>
            <h2>
              One pool. No tiers.
              <br />
              <span className="it">Slide your AUDM in.</span>
            </h2>
          </div>
          <div className="lede">
            One deposit, one soulbound NFT. Your lifetime claim cap unlocks after a 30-day wait
            and grows logarithmically the longer you stay in the pool.
          </div>
        </div>

        <div className="coverage-grid">
          <div className="coverage-left">
            <div className="tier-row">
              <div className="tier active">
                <div className="tier-name">80%</div>
                <div className="tier-price">USDT · AAVE V3</div>
                <div className="tier-meta">
                  Auto-swapped AUDM → USDT on Uniswap and supplied to AAVE for yield. Yield stays
                  in the pool, growing TVL as a solvency cushion.
                </div>
              </div>
              <div className="tier">
                <div className="tier-name">20%</div>
                <div className="tier-price">AUDM · BUFFER</div>
                <div className="tier-meta">
                  Held in the contract so most claims pay instantly without unwinding AAVE or
                  paying swap fees on the way out.
                </div>
              </div>
              <div className="tier">
                <div className="tier-name">SBT</div>
                <div className="tier-price">EIP-5192 · LOCKED</div>
                <div className="tier-meta">
                  Soulbound coverage NFT, minted on deposit. Non-transferable, burnt on withdraw.
                  Vehicle plate hashed on-chain.
                </div>
              </div>
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
                  <span>→ Supplied to AAVE (USDT)</span>
                  <span className="tnum">{fmt(investAmount)} AUDM</span>
                </div>
                <div>
                  <span>→ Held as AUDM buffer</span>
                  <span className="tnum">{fmt(bufferAmount)} AUDM</span>
                </div>
                <div>
                  <span>Wait period</span>
                  <span>{POOL.waitDays} days</span>
                </div>
                <div>
                  <span>Cap formula</span>
                  <span className="mono">stake · {POOL.k} · ln(1 + months)</span>
                </div>
                <div>
                  <span>Pool share estimate</span>
                  <span className="tnum">{sharePct} %</span>
                </div>
                <div className="total">
                  <span>Cap at +12 months</span>
                  <span className="tnum">{fmt(sampleCap12mo)} AUDM</span>
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
                  <div className="label">Coverage NFT</div>
                  <div className="id-card-name">#1</div>
                </div>
                <div className="id-card-tier-badge">SOULBOUND · EIP-5192</div>
              </div>
              <div className="id-card-meta">
                <div>
                  VEHICLE HASH
                  <br />
                  <strong className="mono">0x4f2e…9b3c</strong>
                </div>
                <div>
                  STAKE
                  <br />
                  <strong className="tnum">{fmt(amount)} AUDM</strong>
                </div>
                <div>
                  WALLET
                  <br />
                  <strong className="mono">{shortAddr}</strong>
                </div>
                <div>
                  CAP UNLOCKS
                  <br />
                  <strong>+{POOL.waitDays}d, then grows</strong>
                </div>
              </div>
            </div>

            <div className="pool-stats">
              {tenureRows.map((row) => (
                <div className="pool-stat" key={row.label}>
                  <div className="ticker-label">Cap {row.label}</div>
                  <div className="ticker-val tnum">
                    {fmt(row.cap, 0)}
                    <span className="unit">AUDM</span>
                  </div>
                </div>
              ))}
              <div className="pool-stat">
                <div className="ticker-label">AAVE Yield (live)</div>
                <div className="ticker-val tnum">
                  4.1<span className="unit">%</span>
                </div>
              </div>
              <div className="pool-stat">
                <div className="ticker-label">Yield Harvested (90d)</div>
                <div className="ticker-val tnum">
                  18.4<span className="unit">K USDT</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
