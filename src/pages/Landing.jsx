import { useState, useEffect } from 'react';
import '@/components/landing/landing.css';
import LandingNav from '@/components/landing/LandingNav';
import NewHero from '@/components/landing/NewHero';
import AboutSection from '@/components/landing/AboutSection';
import AppSection from '@/components/landing/AppSection';
import ComparisonSection from '@/components/landing/ComparisonSection';
import DualStructureSection from '@/components/landing/DualStructureSection';
import DomainsSection from '@/components/landing/DomainsSection';
import ResearchSection from '@/components/landing/ResearchSection';
import ClosingCTA from '@/components/landing/ClosingCTA';
import LegalFooter from '@/components/landing/LegalFooter';
import CookieBanner from '@/components/landing/CookieBanner';
import PolicyModals from '@/components/landing/PolicyModals';

export default function Landing() {
  const [openPolicy, setOpenPolicy] = useState(null);
  const [showCookie, setShowCookie] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem('hex6_cookie_consent');
    if (!accepted) setShowCookie(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem('hex6_cookie_consent', 'accepted');
    setShowCookie(false);
  };

  return (
    <div className="landing-page">
      <LandingNav onOpenPolicy={setOpenPolicy} />
      <NewHero />
      <AboutSection />
      <AppSection />
      <ComparisonSection />
      <DualStructureSection />
      <DomainsSection />
      <ResearchSection />
      <ClosingCTA />
      <LegalFooter onOpenPolicy={setOpenPolicy} />

      <PolicyModals openPolicy={openPolicy} onClose={() => setOpenPolicy(null)} />
      {showCookie && (
        <CookieBanner onAccept={handleAccept} onReview={() => setOpenPolicy('privacy')} />
      )}
    </div>
  );
}