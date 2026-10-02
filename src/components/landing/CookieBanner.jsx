export default function CookieBanner({ onAccept, onReview }) {
  return (
    <div className="lp-cookie">
      <p className="lp-cookie-text">
        Evrica Technologies Inc. uses cookies and collects usage data to improve our engine. By continuing,
        you consent to our Terms, Privacy Policy, and Risk Disclosure.{' '}
        <button onClick={onReview}>Review Policies</button>
      </p>
      <div className="lp-cookie-actions">
        <button className="lp-cookie-btn" onClick={onAccept}>Accept &amp; Continue</button>
      </div>
    </div>
  );
}