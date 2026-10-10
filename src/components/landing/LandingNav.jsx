import { useState } from 'react';

export default function LandingNav({ onOpenPolicy }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <header className="lp-header">
        <a href="https://evrica.tech" className="lp-logo" target="_blank" rel="noopener noreferrer">
          <img src="https://media.base44.com/images/public/69eef3d514386627566a9bf6/700b21227_logo.png" alt="Evrica" className="lp-logo-img" />
        </a>
        <button className="lp-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <span /><span /><span />
        </button>
      </header>
      {menuOpen && (
        <div className="lp-menu-overlay">
          <button className="lp-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button>
          <a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>About</a>
          <a href="#app" onClick={(e) => { e.preventDefault(); scrollTo('app'); }}>The App</a>
          <a href="#science" onClick={(e) => { e.preventDefault(); scrollTo('science'); }}>The Science</a>
          <a href="#next" onClick={(e) => { e.preventDefault(); scrollTo('next'); }}>What's Next</a>
          <a href="#research" onClick={(e) => { e.preventDefault(); scrollTo('research'); }}>R&amp;D</a>
          <a href="#enter" onClick={(e) => { e.preventDefault(); scrollTo('enter'); }}>Enter Hex</a>
          <button className="lp-footer-link" onClick={() => { setMenuOpen(false); onOpenPolicy?.('privacy'); }}>Privacy Policy</button>
        </div>
      )}
    </>
  );
}