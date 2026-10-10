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
        <figure className="lp-about-fig lp-about-video-fig">
          <video
            src="https://media.base44.com/videos/public/69eef3d514386627566a9bf6/e2b6f7a16_Raven_Cave_Animation.mp4"
            autoPlay
            loop
            muted
            playsInline
            controls
            aria-label="Ravens watching their shadows in Plato's cave, then one flies out to a bird's-eye view"
          />
          <figcaption>Ravens in the cave — then one sees from above</figcaption>
        </figure>
      </div>
    </section>
  );
}