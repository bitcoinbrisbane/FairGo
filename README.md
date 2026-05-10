# FAIRGO

Parking insurance, on-chain. React + Vite DApp.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Stack

- Vite + React 18 + TypeScript
- wagmi + viem (Base + Base Sepolia, injected connector)
- @tanstack/react-query

## Layout

- `src/main.tsx` — wagmi + react-query providers
- `src/App.tsx` — page composition
- `src/components/` — Header, Hero, Coverage, HowItWorks, Claims, Submit, Governance, Footer
- `src/data.ts` — tiers, claims feed, governance proposals
- `src/styles.css` — full design system (paper + paint colour palette)
- `src/wagmi.ts` — chain + connector config

The original static page is preserved at `fairgo.html` for reference.
