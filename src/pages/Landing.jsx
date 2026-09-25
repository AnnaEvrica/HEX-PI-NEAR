import { useState, useEffect } from 'react';
import '@/components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import LandingCanvas from '@/components/landing/LandingCanvas';
import NewHero from '@/components/landing/NewHero';
import ComparisonSection from '@/components/landing/ComparisonSection';
import StoryEngine from '@/components/landing/StoryEngine';
import DualStructureSection from '@/components/landing/DualStructureSection';
import DomainsSection from '@/components/landing/DomainsSection';
import ClosingCTA from '@/components/landing/ClosingCTA';
import LegalFooter from '@/components/landing/LegalFooter';
import PolicyModals from '@/components/landing/PolicyModals';
import ContactModal from '@/components/landing/ContactModal';
import SearchOverlay from '@/components/landing/SearchOverlay';

export default function Landing() {
  const [openPolicy, setOpenPolicy] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Finale intersection observer — hides topbar when finale is in view
  useEffect(() => {
    const finale = document.getElementById('finale');
    if (!finale || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
      document.querySelector('.landing-page')?.classList.toggle('lp-finale-active', e.isIntersecting && e.intersectionRatio > .45);
    }, { threshold: [0, .45, .7] });
    io.observe(finale);
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-page">
      <LandingCanvas />
      <div className="lp-gutter-emphasis" aria-hidden="true" />
      <div className="lp-shell">
        <LandingNav />
        <NewHero />
        <ComparisonSection />
        <StoryEngine />
        <DualStructureSection />
        <DomainsSection />
        <ClosingCTA onOpenPolicy={setOpenPolicy} />
        <LegalFooter onOpenPolicy={setOpenPolicy} />

        <PolicyModals openPolicy={openPolicy} onClose={() => setOpenPolicy(null)} />
        {showContact && <ContactModal onClose={() => setShowContact(false)} />}
        {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
      </div>
    </div>
  );
}