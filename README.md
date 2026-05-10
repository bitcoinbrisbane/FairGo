# FAIRGO

Calling it FAIRGO — leans into the civic Aussie vibe and reads cleanly as a brand. The whole thing is single-file vanilla HTML/CSS/JS so you can drop it straight into a Vite project or wire it to wagmi/viem when you're ready to make it real.
What's in there:

Hero — big Anton wordmark, a stylised "covered zone" parking sign card, live ticker showing TVL/members/claims paid/approval rate (the TVL number ticks up every 4s to feel alive)
Coverage flow — three tiers (Basic / Standard / Tradie), interactive deposit input that recalcs your pool share against TVL and disables the button if you're under the premium. There's also a mock soulbound NFT "ID card" with vehicle plate + tier
How it works — Deposit → Park → Submit → Paid, with the council-API oracle bit called out
Live claims feed — real-looking infringements from Brunswick St, Fortitude Valley, Bondi, etc. with statuses (PAID / APPROVED / VOTING / REJECTED)
Submit a claim form with an authentic-looking Brisbane City Council parking ticket as the live preview
Governance — four mock proposals including the slash-the-fraudster one and an Auckland expansion via NZDD bridge

Aesthetic decisions worth flagging:

Anton (display) + Fraunces (italic accents) + Geist + Geist Mono — gives it a civic-brutalist + crypto-terminal feel rather than the usual purple-gradient DApp look
Parking-line yellow #F2C200 + asphalt black + sun-bleached cream #F1E9D5, with red used sparingly for fines and green for paid
Hatched dividers and the "ACTIVE" stamp give it that real-world ticket physicality
SVG noise grain overlay for paper texture

To wire up for real, the obvious integration points are:

toggleWallet() → swap for wagmi useConnect
The deposit button → useWriteContract against your pool contract's deposit(uint256)
The claim submit → IPFS upload of the fine image + tx to your OracleClaim.submit()
The claims feed → indexed events from your pool contract via Subgraph or Ponder
