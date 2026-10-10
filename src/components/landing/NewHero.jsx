import RavenArt from './RavenArt';

export default function NewHero() {
  return (
    <section className="lp-hero" id="top">
      <h1 className="lp-hero-heading">Probabilistic Intelligence</h1>
      <hr className="lp-hero-rule" />
      <a href="#enter" className="lp-hero-enter-btn" onClick={(e) => { e.preventDefault(); document.getElementById('enter')?.scrollIntoView({ behavior: 'smooth' }); }}>ENTER HEX [PI]</a>
      <RavenArt variant="hero" className="lp-hero-image" />
      <div className="lp-hero-caption">Fig. 01 · Raven — listens to the decay</div>
    </section>
  );
}