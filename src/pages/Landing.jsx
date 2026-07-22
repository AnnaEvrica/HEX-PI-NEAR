import { X, Mail, Search } from 'lucide-react';
import { useState } from 'react';
import HeroSection from '@/components/landing/HeroSection';
import ContactModal from '@/components/landing/ContactModal';
import SearchOverlay from '@/components/landing/SearchOverlay';

export default function Landing() {
  const [openPolicy, setOpenPolicy] = useState(null);
  const [showContact, setShowContact] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [footerLit, setFooterLit] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 bg-background border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-3 sm:py-4 flex items-center justify-between">
          <a href="https://evrica.tech" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 sm:gap-3">
            <img src="https://media.base44.com/images/public/69eef3d514386627566a9bf6/a8d57d01f_evrica-logo.png" alt="Evrica" className="h-7 sm:h-8 w-7 sm:w-8 object-contain rounded-sm" />
            <span className="text-[0.62rem] sm:text-[0.7rem] text-[#0a1929] font-medium leading-tight tracking-[0.04em] sm:tracking-[0.16em] sm:uppercase">Developed by Evrica Technologies Inc.</span>
          </a>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowSearch(true)}
              aria-label="Search the page"
              className="p-2 rounded-sm hover:bg-muted transition-colors text-foreground"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowContact(true)}
              aria-label="Contact us"
              className="p-2 rounded-sm hover:bg-muted transition-colors text-foreground"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
            >
              <Mail className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <HeroSection onAsteriskHover={setFooterLit} />

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col gap-4 sm:gap-6">
          <p className={`text-xs max-w-3xl leading-relaxed transition-colors duration-300 ${footerLit ? 'text-foreground' : 'text-secondary'}`}>
            The Model is an experimental Probabilistic Intelligence <span className="text-[#0d4f57] font-semibold">[PI]</span> framework proposing a systems methodology for machine learning. It integrates probabilistic inference, semantic analysis, and transformer-based language models within a unified architecture for computational reasoning under uncertainty. It unifies probabilistic inference, semantic analysis, and transformer-based language models within a layered computational architecture. © Evrica Technologies Inc. 2026
          </p>
          <div className="flex gap-6 sm:gap-8 flex-wrap justify-center md:justify-start text-xs text-secondary">
            <button onClick={() => setOpenPolicy('terms')} className="hover:text-foreground transition-colors">
              Terms of Service
            </button>
            <button onClick={() => setOpenPolicy('privacy')} className="hover:text-foreground transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => setOpenPolicy('disclosure')} className="hover:text-foreground transition-colors">
              Risk Disclosure
            </button>
          </div>
        </div>
      </footer>

      {/* Policy Modals */}
      {openPolicy === 'terms' && (
        <PolicyModal title="Terms of Service" onClose={() => setOpenPolicy(null)}>
          <div className="space-y-6 text-sm text-secondary">
            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">1. Acceptance of Terms</h3>
              <p>By accessing and using HEX6 BLE ("Service"), operated by Evrica Technologies Inc., you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use our Service.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">2. Service Definition</h3>
              <p>HEX6 BLE is a probabilistic intelligence platform that analyzes market conditions, models outcome distributions, and generates probabilistic exposure recommendations. The Service is provided for informational and research purposes only and does NOT constitute investment advice, financial advisory services, or portfolio management.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">3. No Financial Advice</h3>
              <p>You acknowledge and agree that:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>HEX6 BLE is not a licensed investment advisor, broker-dealer, or financial institution</li>
                <li>All outputs are probabilistic models, not forecasts or recommendations</li>
                <li>You are solely responsible for all investment decisions and financial outcomes</li>
                <li>You should not rely on HEX6 BLE as a substitute for professional financial advice</li>
                <li>You should consult with a licensed financial advisor before making investment decisions</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">4. Risk Acknowledgment</h3>
              <p>All investments carry substantial risk, including potential loss of principal. Past performance does not guarantee future results. Market conditions change rapidly, and HEX6 BLE outputs may become outdated. You assume full responsibility for all financial losses.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">5. User Responsibilities</h3>
              <p>You agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the Service only for lawful purposes</li>
                <li>Not circumvent security measures or access restrictions</li>
                <li>Not engage in reverse engineering, hacking, or data mining</li>
                <li>Maintain confidentiality of your account credentials</li>
                <li>Comply with all applicable federal, state, and international laws</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">6. Limitation of Liability</h3>
              <p>To the fullest extent permitted by law, Evrica Technologies Inc. shall not be liable for any indirect, incidental, special, or consequential damages, including loss of profits, data, or business opportunity, arising from your use of the Service, even if advised of the possibility of such damages.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">7. Disclaimer of Warranties</h3>
              <p>The Service is provided "AS IS" without warranties of any kind, express or implied. Evrica Technologies Inc. makes no warranty that the Service will be error-free, uninterrupted, or meet your specific needs.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">8. Account Termination</h3>
              <p>Evrica Technologies Inc. reserves the right to terminate or suspend your account at any time, with or without cause, and without notice. Termination may result in deletion of all associated data and content.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">9. Governing Law</h3>
              <p>These Terms shall be governed by and construed in accordance with the laws of California, USA, without regard to its conflict of law provisions. Any legal action or proceeding shall be exclusively brought in the state or federal courts located in California.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">10. Contact</h3>
              <p>For questions or concerns regarding these Terms, please contact: legal@evrica.tech</p>
            </section>

            <p className="text-xs text-secondary/60 pt-4 border-t border-border">Last updated: April 2026. These terms may be updated at any time. Continued use constitutes acceptance.</p>
          </div>
        </PolicyModal>
      )}

      {openPolicy === 'privacy' && (
        <PolicyModal title="Privacy Policy" onClose={() => setOpenPolicy(null)}>
          <div className="space-y-6 text-sm text-secondary">
            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">1. Information We Collect</h3>
              <p>We collect information you provide directly, including:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Account information (email, name, authentication credentials)</li>
                <li>Market queries and conversation history</li>
                <li>Portfolio data and trading preferences</li>
                <li>Device and usage analytics</li>
                <li>IP addresses and device identifiers</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">2. How We Use Your Information</h3>
              <p>Your information is used to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send related information</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Send promotional communications (with opt-out capability)</li>
                <li>Improve algorithm accuracy and system performance</li>
                <li>Comply with legal obligations and enforce our Terms</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">3. Data Security</h3>
              <p>We implement industry-standard security measures including encryption, secure authentication, and restricted access protocols. However, no method of transmission over the internet is entirely secure. We cannot guarantee absolute security of your information.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">4. Conversation Encryption</h3>
              <p>User conversations are encrypted and stored securely. Market analysis data derived from your queries may be anonymized and used to improve system models. You can disable this by adjusting privacy settings in your account.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">5. Data Sharing</h3>
              <p>We do NOT sell your personal information to third parties. We may share data only:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>With service providers (cloud hosting, analytics) under strict data processing agreements</li>
                <li>As required by law or legal process</li>
                <li>To protect against fraud, security threats, or legal liability</li>
                <li>In connection with a merger, acquisition, or asset sale (with notice)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">6. California Privacy Rights (CCPA)</h3>
              <p>California residents have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Know what personal information is collected and how it's used</li>
                <li>Delete personal information (with exceptions for legal compliance)</li>
                <li>Opt-out of data sales (we don't sell data, but you may still opt out)</li>
                <li>Non-discrimination for exercising privacy rights</li>
              </ul>
              <p className="pt-2">To exercise these rights, email: privacy@evrica.tech</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">7. GDPR Compliance (EU/EEA Users)</h3>
              <p>For users in the EU/EEA, we comply with GDPR. You have rights including access, rectification, erasure, and data portability. Our legal basis for processing is consent and legitimate interest. Contact privacy@evrica.tech for GDPR-related requests.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">8. Cookies and Tracking</h3>
              <p>We use cookies and similar technologies for authentication and session management. Most browsers allow you to reject or delete cookies. However, some features may not function properly without cookies.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">9. Data Retention</h3>
              <p>We retain personal information as long as necessary to provide services or comply with legal obligations. You may request deletion of your data by contacting privacy@evrica.tech</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">10. Third-Party Links</h3>
              <p>Our Service may contain links to third-party websites. We are not responsible for their privacy practices. Review their privacy policies before providing information.</p>
            </section>

            <p className="text-xs text-secondary/60 pt-4 border-t border-border">Last updated: April 2026. Privacy policy changes will be announced with notice.</p>
          </div>
        </PolicyModal>
      )}

      {openPolicy === 'disclosure' && (
        <PolicyModal title="Risk Disclosure & Compliance" onClose={() => setOpenPolicy(null)}>
          <div className="space-y-6 text-sm text-secondary">
            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">1. Important Risk Disclosures</h3>
              <p>Trading and investing involve substantial risk of loss of capital. Past performance is not indicative of future results. Market conditions change rapidly and unpredictably.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">2. Model Limitations</h3>
              <p>HEX6 BLE outputs are probabilistic models based on historical data and mathematical assumptions. Limitations include:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Historical data may not repeat or predict future outcomes</li>
                <li>Unprecedented market conditions may cause model failures</li>
                <li>Black swan events and discontinuities cannot be reliably predicted</li>
                <li>Model assumptions may be invalid in extreme market regimes</li>
                <li>System state classifications are probabilistic, not certain</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">3. Regulatory Compliance</h3>
              <p>Evrica Technologies Inc. is NOT a registered investment advisor, broker-dealer, or financial institution. The Service is not subject to SEC or FINRA oversight. Users should verify their own regulatory obligations, including but not limited to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Suitability of investments under their circumstances</li>
                <li>Tax reporting and compliance obligations</li>
                <li>Restrictions on trading in their jurisdiction</li>
                <li>Custody and settlement procedures</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">4. Restricted Users</h3>
              <p>The Service is not available to users who are:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Subject to sanctions or restrictions under OFAC/SDN lists</li>
                <li>Located in prohibited jurisdictions</li>
                <li>Related to prohibited industries or entities</li>
                <li>Minors (under 18 years of age)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">5. Performance Claims</h3>
              <p>Any historical performance data presented is for illustration only and does not constitute a guarantee or warranty of future performance. Actual results may differ materially due to market conditions, execution costs, slippage, and other factors.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">6. Leverage and Margin Risks</h3>
              <p>Trading with leverage or margin amplifies both gains and losses. You may lose more than your initial investment. Margin calls can force liquidation of positions at unfavorable prices.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">7. Technology Risks</h3>
              <p>The Service may experience downtime, connectivity issues, or system failures. We are not liable for losses resulting from technical failures, hacking, or unavailability of the Service.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">8. Execution and Counterparty Risk</h3>
              <p>If you use the Service with a broker or exchange, you assume all risks of counterparty failure, settlement failures, and execution slippage. Review your broker's disclosures separately.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">9. Conflicts of Interest</h3>
              <p>Evrica Technologies Inc. may have financial interests that differ from yours. We disclose that our revenue may be derived from subscription fees, and we have no incentive to hide underperformance from users.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">10. Professional Advice</h3>
              <p>Before using this Service for significant investments, you should consult with a qualified financial advisor, tax professional, and legal counsel to ensure compliance with your circumstances and local laws.</p>
            </section>

            <p className="text-xs text-secondary/60 pt-4 border-t border-border">Last updated: April 2026. All disclosures subject to change without notice.</p>
          </div>
        </PolicyModal>
      )}

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
    </div>
  );
}

function PolicyModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-6">{children}</div>
        <div className="border-t border-border px-6 py-4 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}