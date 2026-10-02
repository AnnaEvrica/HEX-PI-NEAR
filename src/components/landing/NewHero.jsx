import RavenArt from './RavenArt';

export default function NewHero() {
  return (
    <section className="lp-hero" id="top">
      <h1 className="lp-hero-heading">Probabilistic Intelligence</h1>
      <hr className="lp-hero-rule" />
      <p className="lp-hero-subtext">An inverted language model. One signal at a time.</p>
      <RavenArt variant="hero" className="lp-hero-image" />
      <div className="lp-hero-caption">Fig. 01 · Raven — listens to the decay</div>
    </section>
  );
}