// Pool economics — must mirror the on-chain immutables in FairGoPool.sol.
export const POOL = {
  waitDays: 30,        // WAIT_PERIOD
  monthDays: 30,       // MONTH
  k: 1.5,              // K_WAD
  investBps: 8000,     // 80% of every deposit goes to USDT → AAVE
  bufferBps: 2000,     // 20% stays as AUDM in the pool for instant claims
} as const;

/// Lifetime claim cap (in AUDM) for a given stake at `monthsAfterWait` months
/// past the wait period. Returns 0 inside the wait window.
export function coverageCap(stakeAudm: number, monthsAfterWait: number): number {
  if (monthsAfterWait <= 0) return 0;
  return stakeAudm * POOL.k * Math.log(1 + monthsAfterWait);
}

/// Sample tenure points used to render a "your cap over time" preview.
export const TENURE_PREVIEW: Array<{ label: string; months: number }> = [
  { label: '+1 mo', months: 1 },
  { label: '+3 mo', months: 3 },
  { label: '+6 mo', months: 6 },
  { label: '+1 yr', months: 12 },
  { label: '+2 yr', months: 24 },
];

export type ClaimStatus = 'paid' | 'approved' | 'voting' | 'rejected';

export interface Claim {
  id: string;
  location: string;
  offence: string;
  amount: number;
  status: ClaimStatus;
  statusLabel: string;
  when: string;
}

export const CLAIMS: Claim[] = [
  {
    id: '#FG-2841',
    location: 'Brunswick St, Fitzroy VIC',
    offence: 'Expired meter',
    amount: 98,
    status: 'paid',
    statusLabel: 'PAID',
    when: '2 min ago',
  },
  {
    id: '#FG-2840',
    location: 'Wickham St, Fortitude Valley QLD',
    offence: 'No standing',
    amount: 156,
    status: 'approved',
    statusLabel: 'APPROVED',
    when: '11 min ago',
  },
  {
    id: '#FG-2839',
    location: 'Campbell Pde, Bondi Beach NSW',
    offence: 'Permit zone violation',
    amount: 87,
    status: 'voting',
    statusLabel: 'VOTING · 1H',
    when: '28 min ago',
  },
  {
    id: '#FG-2838',
    location: 'Cavill Ave, Surfers Paradise QLD',
    offence: 'Loading zone, >15 min',
    amount: 112,
    status: 'paid',
    statusLabel: 'PAID',
    when: '42 min ago',
  },
  {
    id: '#FG-2837',
    location: 'Rundle St, Adelaide SA',
    offence: 'Disabled bay (no permit)',
    amount: 827,
    status: 'rejected',
    statusLabel: 'REJECTED',
    when: '1 hr ago',
  },
  {
    id: '#FG-2836',
    location: 'Hay St Mall, Perth WA',
    offence: 'Time limit exceeded',
    amount: 66,
    status: 'paid',
    statusLabel: 'PAID',
    when: '2 hr ago',
  },
  {
    id: '#FG-2835',
    location: 'Salamanca Pl, Hobart TAS',
    offence: 'No ticket displayed',
    amount: 79,
    status: 'paid',
    statusLabel: 'PAID',
    when: '3 hr ago',
  },
];

export interface Proposal {
  title: string;
  govId: string;
  body: string;
  yesPct: number;
  yesLabel: string;
  noLabel: string;
  noPctOverride?: number;
}

export const PROPOSALS: Proposal[] = [
  {
    title: 'Lower premium for EV drivers',
    govId: 'FAIRGO-23 · Closes in 2d 14h · Quorum reached',
    body:
      'Reduce STANDARD tier from 120 to 100 AUDM/mo for vehicles registered electric. Council parking levy is 50% lower for EVs in most LGAs, so the pool risk drops with it.',
    yesPct: 62,
    yesLabel: 'YES · 62.4% · 412k AUDM',
    noLabel: 'NO · 37.6% · 248k AUDM',
  },
  {
    title: 'Slash fraudulent claim #FG-2741',
    govId: 'FAIRGO-22 · Closes in 19h · Quorum reached',
    body:
      'Wallet 0x91…b7c2 submitted a doctored infringement number. Oracle flagged. Proposal to slash 100% of staked AUDM and ban the soulbound NFT.',
    yesPct: 91,
    yesLabel: 'SLASH · 91.2%',
    noLabel: 'SPARE · 8.8%',
  },
  {
    title: 'Add Auckland Council to oracle',
    govId: 'FAIRGO-21 · Closes in 5d · Quorum 41%',
    body:
      'Expand FAIRGO to NZ. Auckland Transport’s API supports infringement lookup. Premium tier "Kiwi" priced at 130 AUDM. Bridges via AUDM ↔ NZDD.',
    yesPct: 71,
    yesLabel: 'YES · 71.0%',
    noLabel: 'NO · 29.0%',
  },
  {
    title: 'Quarterly surplus distribution',
    govId: 'FAIRGO-20 · Q1 2026 · Executed',
    body:
      '118,400 AUDM treasury surplus distributed pro-rata to depositors. Proportional to time-weighted stake during the period.',
    yesPct: 96,
    yesLabel: 'PASSED · 96.1%',
    noLabel: 'EXECUTED 12 APR',
  },
];
