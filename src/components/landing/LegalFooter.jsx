export default function LegalFooter({ onOpenPolicy }) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-social">
        <a href="https://discord.gg/hex6ble" target="_blank" rel="noopener noreferrer">Discord</a>
        <a href="https://x.com/EvricaTech" target="_blank" rel="noopener noreferrer">Follow on X</a>
        <a href="https://evrica.tech" target="_blank" rel="noopener noreferrer">Evrica Technologies</a>
      </div>
      <div className="lp-footer-links">
        <button className="lp-footer-link" onClick={() => onOpenPolicy('terms')}>Terms of Service</button>
        <button className="lp-footer-link" onClick={() => onOpenPolicy('privacy')}>Privacy Policy</button>
        <button className="lp-footer-link" onClick={() => onOpenPolicy('disclosure')}>Risk Disclosure</button>
      </div>
      <p className="lp-footer-disclaimer">
        Hex is an experimental Probabilistic Intelligence model. All outputs are probabilistic and
        informational — not financial, investment, legal, tax, or professional advice. Nothing here
        constitutes a recommendation to buy, sell, or hold any asset. Past patterns do not guarantee
        future results. Consult a licensed professional before making any decision.
      </p>
      <p className="lp-footer-copyright">© 2026 Evrica Technologies Inc. — All rights reserved.</p>
    </footer>
  );
}