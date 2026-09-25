export default function LegalFooter({ onOpenPolicy }) {
  return (
    <footer className="lp-legal-footer">
      <div className="lp-legal-inner">
        <p className="lp-legal-disclaimer">
          HEX6-BLE is an experimental Probabilistic Intelligence model. All outputs are probabilistic
          and informational — not financial, investment, legal, tax, or professional advice. Nothing
          here constitutes a recommendation to buy, sell, or hold any asset. Past patterns do not
          guarantee future results. Consult a licensed professional before making any decision.
        </p>
        <div className="lp-legal-links">
          <button onClick={() => onOpenPolicy('terms')}>Terms of Service</button>
          <button onClick={() => onOpenPolicy('privacy')}>Privacy Policy</button>
          <button onClick={() => onOpenPolicy('disclosure')}>Risk Disclosure</button>
        </div>
        <p className="lp-legal-copyright">© 2023 Evrica Technologies Inc. — All rights reserved.</p>
      </div>
    </footer>
  );
}