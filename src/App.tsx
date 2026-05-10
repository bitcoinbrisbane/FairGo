import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Coverage } from './components/Coverage';
import { HowItWorks } from './components/HowItWorks';
import { Claims } from './components/Claims';
import { Submit } from './components/Submit';
import { Governance } from './components/Governance';
import { Footer } from './components/Footer';

export function App() {
  return (
    <>
      <Header />
      <Hero />
      <div className="hatch-divider" />
      <Coverage />
      <HowItWorks />
      <Claims />
      <Submit />
      <Governance />
      <div className="hatch-divider" />
      <Footer />
    </>
  );
}
