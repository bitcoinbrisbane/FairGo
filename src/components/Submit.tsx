import { useRef, useState } from 'react';

const AUTHORITIES = [
  'Brisbane City Council',
  'City of Melbourne',
  'City of Sydney',
  'Gold Coast City Council',
  'Sunshine Coast Regional',
  'City of Perth',
  'NSW Police (Privately enforced)',
];

export function Submit() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [authority, setAuthority] = useState(AUTHORITIES[0]);
  const [infringement, setInfringement] = useState('');
  const [date, setDate] = useState('2026-05-08');
  const [amount, setAmount] = useState<number>(156);
  const [notes, setNotes] = useState('');

  const onSubmit = () => {
    alert(`Submitting to FAIRGO Oracle…\n${authority} · ${infringement || 'no infringement #'} · $${amount}`);
  };

  return (
    <section id="submit">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="num">04 · Lodge a Claim</div>
            <h2>
              Got a ticket?
              <br />
              <span className="it">Hand it over.</span>
            </h2>
          </div>
          <div className="lede">
            Submission auto-cross-checks against the issuing council's infringement registry via
            FairGo Oracle. Most claims are approved in under 90 seconds.
          </div>
        </div>

        <div className="claim-form">
          <div className="form-side">
            <div className="upload" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" hidden accept="image/*,.pdf" />
              <div className="upload-title">↑ Drop or scan your fine</div>
              <div className="upload-sub">JPG · PNG · PDF · max 8 MB</div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Issuing Authority</label>
                <select value={authority} onChange={(e) => setAuthority(e.target.value)}>
                  {AUTHORITIES.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Infringement #</label>
                <input
                  type="text"
                  placeholder="e.g. 47823-2026-Q"
                  value={infringement}
                  onChange={(e) => setInfringement(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>Date of Offence</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Fine Amount (AUD)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                />
              </div>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label>Notes for the DAO</label>
              <textarea
                placeholder="Optional. Won't change the outcome — the oracle is the source of truth."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="deposit-cta"
              onClick={onSubmit}
              style={{ background: 'var(--paint)', color: 'var(--ink)' }}
            >
              Submit Claim →
            </button>
          </div>

          <div className="ticket-preview">
            <div
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-soft)',
                marginBottom: 14,
              }}
            >
              Preview
            </div>
            <div className="fake-ticket">
              <div className="fake-ticket-head">
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '0.15em' }}>QUEENSLAND · BRISBANE</div>
                  <div className="big">PARKING INFRINGEMENT</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 10 }}>
                  No.
                  <br />
                  {infringement || '47823-2026-Q'}
                </div>
              </div>
              <div className="row">
                <span>VEHICLE</span>
                <span>QLD 047 LCS</span>
              </div>
              <div className="row">
                <span>OFFENCE</span>
                <span>NO STANDING</span>
              </div>
              <div className="row">
                <span>LOCATION</span>
                <span>WICKHAM ST</span>
              </div>
              <div className="row">
                <span>DATE</span>
                <span>{date.toUpperCase()} · 14:21</span>
              </div>
              <div
                className="row"
                style={{ borderTop: '1px dashed var(--ink)', paddingTop: 6, marginTop: 6 }}
              >
                <span>
                  <b>PENALTY</b>
                </span>
                <span>
                  <b>${amount.toFixed(2)}</b>
                </span>
              </div>
              <div className="stamp">FAIRGO ✓</div>
            </div>
            <div
              style={{
                marginTop: 18,
                fontFamily: "'Fraunces', serif",
                fontStyle: 'italic',
                fontSize: 14,
                color: 'var(--ink-soft)',
                lineHeight: 1.5,
              }}
            >
              "Brought it home in under 90 seconds. Reckon I'll keep the change."
              <div
                style={{
                  fontStyle: 'normal',
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 11,
                  marginTop: 6,
                }}
              >
                — 0x8a4f…dE12
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
