import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import ComplianceBar from '@/components/ComplianceBar';
import StatsBar from '@/components/StatsBar';
import Features from '@/components/Features';
import PAAgent from '@/components/PAAgent';
import Pricing from '@/components/Pricing';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#050608] text-[#e8edf5] overflow-x-hidden">
      {/* Grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      <Nav />
      <Hero />
      <ComplianceBar />
      <StatsBar />
      <Features />
      <PAAgent />
      <Pricing />
      <Footer />
    </main>
  );
}
