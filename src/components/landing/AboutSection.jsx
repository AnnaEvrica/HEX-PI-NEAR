export default function AboutSection() {
  return (
    <section className="lp-section" id="about">
      <div className="lp-section-inner">
        <div className="lp-section-label">02 / About · Signal enhancement, expanded</div>
        <div className="lp-about-grid">
          <h2 className="lp-section-heading">Time for higher standards in <em>reasoning.</em></h2>
          <p className="lp-section-body lp-about-body">
            AI predicts the next word. Hex predicts the next outcome, by reading signals the way living things do.
            Where others validate against training data, Hex inverts the model — finding and enhancing patterns
            in the decay, then calibrating each signal against what actually happens.
          </p>
        </div>
        <div className="lp-about-images">
          <figure className="lp-about-fig">
            <img
              src="https://media.base44.com/images/public/69eef3d514386627566a9bf6/b3af427c4_generated_image.png"
              alt="Plato's cave as an echo chamber"
              decoding="async"
            />
            <figcaption>Plato's Cave — the echo chamber</figcaption>
          </figure>
          <figure className="lp-about-fig">
            <img
              src="https://media.base44.com/images/public/69eef3d514386627566a9bf6/f34186878_generated_image.png"
              alt="Bird's eye view of lights, shadows, and forms"
              decoding="async"
            />
            <figcaption>Bird's Eye — lights, shadows, forms</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}