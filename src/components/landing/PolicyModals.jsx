import { X } from 'lucide-react';

export default function PolicyModals({ openPolicy, onClose }) {
  if (!openPolicy) return null;

  const titleMap = {
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    disclosure: 'Risk Disclosure & Compliance',
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-landing-sheet rounded-sm max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-landing-ink/10 shrink-0">
          <h2 className="text-lg font-bold text-landing-ink">{titleMap[openPolicy]}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-landing-ink/10 rounded transition-colors"
          >
            <X className="w-5 h-5 text-landing-ink" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-6 text-landing-ink">
          {openPolicy === 'terms' && <TermsContent />}
          {openPolicy === 'privacy' && <PrivacyContent />}
          {openPolicy === 'disclosure' && <DisclosureContent />}
        </div>
        <div className="border-t border-landing-ink/10 px-6 py-4 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-landing-ink text-landing-sheet hover:bg-landing-ink/90 transition-colors text-sm font-medium rounded-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h3 className="font-bold text-landing-ink text-lg">{title}</h3>
      {children}
    </section>
  );
}

function TermsContent() {
  return (
    <div className="space-y-6 text-sm text-landing-ink/80">
      <Section title="1. Acceptance of Terms">
        <p>
          By accessing and using HEX6 BLE ("Service"), operated by Evrica Technologies Inc., you agree
          to be bound by these Terms of Service and all applicable laws and regulations. If you do not
          agree with any part of these terms, you may not use our Service.
        </p>
      </Section>
      <Section title="2. Service Definition">
        <p>
          HEX6 BLE is an experimental Probabilistic Intelligence model that supports enhanced reasoning
          through probabilistic, informational outputs. The Service is provided for informational and
          exploratory purposes only and does NOT constitute investment advice, financial advisory
          services, or portfolio management.
        </p>
      </Section>
      <Section title="3. No Financial Advice">
        <p>You acknowledge and agree that:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>HEX6 BLE is not a licensed investment advisor, broker-dealer, or financial institution</li>
          <li>All outputs are probabilistic models, not forecasts or recommendations</li>
          <li>You are solely responsible for how you interpret and apply any output</li>
          <li>You should not rely on HEX6 BLE as a substitute for professional financial advice</li>
          <li>You should consult with a licensed financial advisor before making investment decisions</li>
        </ul>
      </Section>
      <Section title="4. Risk Acknowledgment">
        <p>
          HEX6 BLE is an experimental Probabilistic Intelligence model. Outputs are probabilistic and
          informational, not predictions or guarantees. Past patterns do not guarantee future results,
          and conditions change rapidly so outputs may become outdated. You apply any output at your own
          discretion.
        </p>
      </Section>
      <Section title="5. User Responsibilities">
        <p>You agree to:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Use the Service only for lawful purposes</li>
          <li>Not circumvent security measures or access restrictions</li>
          <li>Not engage in reverse engineering, hacking, or data mining</li>
          <li>Maintain confidentiality of your account credentials</li>
          <li>Comply with all applicable federal, state, and international laws</li>
        </ul>
      </Section>
      <Section title="6. Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Evrica Technologies Inc. shall not be liable for any
          indirect, incidental, special, or consequential damages arising from your use of this
          experimental model, even if advised of the possibility of such damages.
        </p>
      </Section>
      <Section title="7. Disclaimer of Warranties">
        <p>
          The Service is provided "AS IS" without warranties of any kind, express or implied. Evrica
          Technologies Inc. makes no warranty that the Service will be error-free, uninterrupted, or meet
          your specific needs.
        </p>
      </Section>
      <Section title="8. Account Termination">
        <p>
          Evrica Technologies Inc. reserves the right to terminate or suspend your account at any time,
          with or without cause, and without notice. Termination may result in deletion of all
          associated data and content.
        </p>
      </Section>
      <Section title="9. Governing Law">
        <p>
          These Terms shall be governed by and construed in accordance with the laws of California, USA,
          without regard to its conflict of law provisions. Any legal action or proceeding shall be
          exclusively brought in the state or federal courts located in California.
        </p>
      </Section>
      <Section title="10. Contact">
        <p>For questions or concerns regarding these Terms, please contact: legal@evrica.tech</p>
      </Section>
      <p className="text-xs text-landing-ink/50 pt-4 border-t border-landing-ink/10">
        Last updated: April 2026. These terms may be updated at any time. Continued use constitutes
        acceptance.
      </p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-6 text-sm text-landing-ink/80">
      <Section title="1. Information We Collect">
        <p>We collect information you provide directly, including:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Account information (email, name, authentication credentials)</li>
          <li>Market queries and conversation history</li>
          <li>Portfolio data and trading preferences</li>
          <li>Device and usage analytics</li>
          <li>IP addresses and device identifiers</li>
        </ul>
      </Section>
      <Section title="2. How We Use Your Information">
        <p>Your information is used to:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Provide, maintain, and improve the Service</li>
          <li>Process transactions and send related information</li>
          <li>Respond to your inquiries and provide customer support</li>
          <li>Send promotional communications (with opt-out capability)</li>
          <li>Improve algorithm accuracy and system performance</li>
          <li>Comply with legal obligations and enforce our Terms</li>
        </ul>
      </Section>
      <Section title="3. Data Security">
        <p>
          We implement industry-standard security measures including encryption, secure authentication,
          and restricted access protocols. However, no method of transmission over the internet is
          entirely secure. We cannot guarantee absolute security of your information.
        </p>
      </Section>
      <Section title="4. Conversation Encryption">
        <p>
          User conversations are encrypted and stored securely. Market analysis data derived from your
          queries may be anonymized and used to improve system models. You can disable this by adjusting
          privacy settings in your account.
        </p>
      </Section>
      <Section title="5. Data Sharing">
        <p>We do NOT sell your personal information to third parties. We may share data only:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>With service providers (cloud hosting, analytics) under strict data processing agreements</li>
          <li>As required by law or legal process</li>
          <li>To protect against fraud, security threats, or legal liability</li>
          <li>In connection with a merger, acquisition, or asset sale (with notice)</li>
        </ul>
      </Section>
      <Section title="6. California Privacy Rights (CCPA)">
        <p>California residents have the right to:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Know what personal information is collected and how it's used</li>
          <li>Delete personal information (with exceptions for legal compliance)</li>
          <li>Opt-out of data sales (we don't sell data, but you may still opt out)</li>
          <li>Non-discrimination for exercising privacy rights</li>
        </ul>
        <p className="pt-2">To exercise these rights, email: privacy@evrica.tech</p>
      </Section>
      <Section title="7. GDPR Compliance (EU/EEA Users)">
        <p>
          For users in the EU/EEA, we comply with GDPR. You have rights including access, rectification,
          erasure, and data portability. Our legal basis for processing is consent and legitimate
          interest. Contact privacy@evrica.tech for GDPR-related requests.
        </p>
      </Section>
      <Section title="8. Cookies and Tracking">
        <p>
          We use cookies and similar technologies for authentication and session management. Most
          browsers allow you to reject or delete cookies. However, some features may not function
          properly without cookies.
        </p>
      </Section>
      <Section title="9. Data Retention">
        <p>
          We retain personal information as long as necessary to provide services or comply with legal
          obligations. You may request deletion of your data by contacting privacy@evrica.tech
        </p>
      </Section>
      <Section title="10. Third-Party Links">
        <p>
          Our Service may contain links to third-party websites. We are not responsible for their privacy
          practices. Review their privacy policies before providing information.
        </p>
      </Section>
      <p className="text-xs text-landing-ink/50 pt-4 border-t border-landing-ink/10">
        Last updated: April 2026. Privacy policy changes will be announced with notice.
      </p>
    </div>
  );
}

function DisclosureContent() {
  return (
    <div className="space-y-6 text-sm text-landing-ink/80">
      <Section title="1. Important Risk Disclosures">
        <p>
          HEX6 BLE is an experimental Probabilistic Intelligence model. Its goal is to provide maximum
          value to you through enhanced reasoning — not to predict or guarantee outcomes. Past patterns
          are not indicative of future results, and conditions change rapidly.
        </p>
      </Section>
      <Section title="2. Model Limitations">
        <p>
          HEX6 BLE outputs are probabilistic models based on historical data and mathematical
          assumptions. Limitations include:
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Historical data may not repeat or predict future outcomes</li>
          <li>Unprecedented market conditions may cause model failures</li>
          <li>Black swan events and discontinuities cannot be reliably predicted</li>
          <li>Model assumptions may be invalid in extreme market regimes</li>
          <li>System state classifications are probabilistic, not certain</li>
        </ul>
      </Section>
      <Section title="3. Regulatory Compliance">
        <p>
          Evrica Technologies Inc. is NOT a registered investment advisor, broker-dealer, or financial
          institution. The Service is not subject to SEC or FINRA oversight. Users should verify their
          own regulatory obligations, including but not limited to:
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Suitability of investments under their circumstances</li>
          <li>Tax reporting and compliance obligations</li>
          <li>Restrictions on trading in their jurisdiction</li>
          <li>Custody and settlement procedures</li>
        </ul>
      </Section>
      <Section title="4. Restricted Users">
        <p>The Service is not available to users who are:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Subject to sanctions or restrictions under OFAC/SDN lists</li>
          <li>Located in prohibited jurisdictions</li>
          <li>Related to prohibited industries or entities</li>
          <li>Minors (under 18 years of age)</li>
        </ul>
      </Section>
      <Section title="5. Performance Claims">
        <p>
          Any historical performance data presented is for illustration only and does not constitute a
          guarantee or warranty of future performance. Actual results may differ materially due to market
          conditions, execution costs, slippage, and other factors.
        </p>
      </Section>
      <Section title="6. Leverage and Margin Risks">
        <p>
          HEX6 BLE does not execute trades or manage capital. Any trading activity you undertake is
          entirely independent of this Service and at your own direction.
        </p>
      </Section>
      <Section title="7. Technology Risks">
        <p>
          The Service may experience downtime, connectivity issues, or system failures. We are not
          liable for disruptions resulting from technical failures or unavailability of the Service.
        </p>
      </Section>
      <Section title="8. Execution and Counterparty Risk">
        <p>
          If you use the Service with a broker or exchange, you assume all risks of counterparty failure,
          settlement failures, and execution slippage. Review your broker's disclosures separately.
        </p>
      </Section>
      <Section title="9. Conflicts of Interest">
        <p>
          Evrica Technologies Inc. may have financial interests that differ from yours. We disclose that
          our revenue may be derived from subscription fees, and we have no incentive to hide
          underperformance from users.
        </p>
      </Section>
      <Section title="10. Professional Advice">
        <p>
          Before using this Service for significant investments, you should consult with a qualified
          financial advisor, tax professional, and legal counsel to ensure compliance with your
          circumstances and local laws.
        </p>
      </Section>
      <p className="text-xs text-landing-ink/50 pt-4 border-t border-landing-ink/10">
        Last updated: April 2026. All disclosures subject to change without notice.
      </p>
    </div>
  );
}