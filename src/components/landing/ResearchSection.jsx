export default function ResearchSection() {
  const R_AND_D_DRIVE_URL = 'https://drive.google.com/drive/folders/19Uq4REAzcS10SY9aZwDu6bIW0uY-UsBt?usp=share_link';

  return (
    <section className="lp-section" id="research">
      <div className="lp-section-inner">
        <div className="lp-section-label">05 / R&amp;D</div>
        <h2 className="lp-section-heading">The <em>science</em> behind the signal.</h2>
        <p className="lp-section-body">
          Hex is built on a falsifiable method: state a probability before the
          outcome is known, score it against what actually happens, and fold the
          result back into the engine. Every call is a preregistered prediction.
          The academic articles, derivations, and validation notebooks live in
          the research folder below.
        </p>
        <a
          href={R_AND_D_DRIVE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="lp-app-link"
          style={{ marginTop: '28px', display: 'inline-block' }}
        >
          Open the R&amp;D folder →
        </a>
      </div>
    </section>
  );
}