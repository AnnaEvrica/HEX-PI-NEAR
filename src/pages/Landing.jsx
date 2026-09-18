import { useState } from 'react';
import LandingNav from '@/components/landing/LandingNav';
import NewHero from '@/components/landing/NewHero';
import ComparisonSection from '@/components/landing/ComparisonSection';
import TransitionsSection from '@/components/landing/TransitionsSection';
import DomainsSection from '@/components/landing/DomainsSection';
import InspectSection from '@/components/landing/InspectSection';
import ClosingCTA from '@/components/landing/ClosingCTA';
import PolicyModals from '@/components/landing/PolicyModals';
import ContactModal from '@/components/landing/ContactModal';
import SearchOverlay from '@/components/landing/SearchOverlay';

export default function Landing() {
  const [openPolicy, setOpenPolicy] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="h-screen overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth bg-landing-bg text-landing-sheet">
      <LandingNav onSearch={() => setShowSearch(true)} onContact={() => setShowContact(true)} />
      <NewHero />
      <ComparisonSection />
      <TransitionsSection />
      <DomainsSection />
      <InspectSection />
      <ClosingCTA onOpenPolicy={setOpenPolicy} />

      <PolicyModals openPolicy={openPolicy} onClose={() => setOpenPolicy(null)} />
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
    </div>
  );
}