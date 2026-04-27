import { X } from 'lucide-react';

export default function LegalModal({ open, onClose }) {
  if (!open) return null;

  const policies = [
    {
      title: 'Terms of Service',
      content: `HEX6 Oracle is provided "as-is" for informational purposes only. By accessing this platform, you agree that:

• HEX6 does not provide investment advice, financial recommendations, or portfolio management services
• You are solely responsible for all investment decisions and financial outcomes
• HEX6 outputs are probabilistic models, not guarantees, and may be incorrect
• You will not hold Evrica Technologies Inc. liable for financial losses
• Your use of the platform is governed by these terms and all applicable laws`,
    },
    {
      title: 'Privacy Policy',
      content: `We respect your privacy. Here's how we handle your data:

• Your conversation history is encrypted and stored securely
• We do not sell your personal information to third parties
• Market queries and analysis may be used to improve our models (anonymized)
• You can request deletion of your conversation history at any time
• We comply with GDPR, CCPA, and other applicable privacy regulations
• Cookies are used only for authentication and session management`,
    },
    {
      title: 'Risk Disclosure',
      content: `Trading and investing involve substantial risk of loss. Important disclosures:

• Past performance does not guarantee future results
• All investments carry the risk of total loss of capital
• HEX6 models are based on historical data which may not repeat
• Market conditions change rapidly; HEX6 recommendations may become outdated
• Voice inputs and model selections do not affect legal liability
• You should consult with a licensed financial advisor before making investment decisions
• Evrica Technologies Inc. is not registered as an investment advisor or broker`,
    },
    {
      title: 'Acceptable Use',
      content: `By using HEX6, you agree not to:

• Use the platform for illegal activities or to circumvent regulations
• Attempt to reverse-engineer, hack, or interfere with our systems
• Use voice input for abusive, defamatory, or misleading purposes
• Impersonate others or provide false information
• Overload our systems with automated requests
• Share your account credentials with others
• Use the platform on behalf of restricted entities (sanctions, etc.)

Violation of these terms may result in account suspension or termination.`,
    },
    {
      title: 'Limitation of Liability',
      content: `To the fullest extent permitted by law:

• Evrica Technologies Inc. shall not be liable for indirect, incidental, or consequential damages
• Our liability is limited to the amount you paid for the platform (if any)
• We provide no warranty that the platform will be error-free or uninterrupted
• We are not liable for third-party actions, market conditions, or external events
• These limitations apply even if we've been advised of the possibility of damages`,
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">Legal & Policies</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-8">
          {policies.map((policy, idx) => (
            <div key={idx} className="space-y-2">
              <h3 className="text-sm font-bold text-accent">{policy.title}</h3>
              <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">
                {policy.content}
              </p>
            </div>
          ))}

          {/* Footer disclaimer */}
          <div className="border-t border-border pt-4 mt-8">
            <p className="text-xs text-secondary/60">
              Last updated: April 2026. These policies may be updated at any time. Continued use of the platform constitutes acceptance of updated terms. For legal inquiries, contact legal@evrica.tech.
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="border-t border-border px-6 py-4 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            I Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}