import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronRight, Check } from 'lucide-react';

const STEPS = [
  {
    id: 'system-framing',
    title: 'System Definition',
    subtitle: 'What HEX6 is and isn\'t',
    skippable: false,
  },
  {
    id: 'risk-acknowledgment',
    title: 'Risk & Responsibility',
    subtitle: 'You understand the risks',
    skippable: false,
  },
  {
    id: 'modular-consent',
    title: 'Data & Consent',
    subtitle: 'Control your preferences',
    skippable: false,
  },
  {
    id: 'legal-acceptance',
    title: 'Terms & Conditions',
    subtitle: 'Final agreement',
    skippable: false,
  },
];

function Step1SystemFraming({ onContinue }) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">What is HEX6?</h2>
        <p className="text-secondary">A probabilistic allocation intelligence system.</p>
      </div>

      <div className="space-y-4 p-6 rounded-sm bg-muted border border-border">
        <p className="font-medium">HEX6 is a computational system that:</p>
        <ul className="space-y-2 text-sm text-secondary">
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Analyzes market data to generate model-derived exposure fields</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Does NOT provide investment advice or fiduciary services</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Does NOT execute trades or manage your capital</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Generates outputs that are informational, not instructional</span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          I Understand <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Step2RiskAcknowledgment({ onContinue }) {
  const [checks, setChecks] = useState({
    probabilistic: false,
    independent: false,
    notAdvisor: false,
    bearLoss: false,
  });

  const allChecked = Object.values(checks).every(Boolean);

  const handleToggle = (key) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">You must acknowledge:</h2>
        <p className="text-secondary">All of the following before continuing</p>
      </div>

      <div className="space-y-3">
        {[
          {
            key: 'probabilistic',
            label: 'I understand HEX6 outputs are probabilistic and may be incorrect',
          },
          {
            key: 'independent',
            label: 'I make all financial decisions independently',
          },
          {
            key: 'notAdvisor',
            label: 'I am not relying on HEX6 as a financial advisor or fiduciary',
          },
          {
            key: 'bearLoss',
            label: 'I can bear financial loss without material hardship',
          },
        ].map(({ key, label }) => (
          <label
            key={key}
            className="flex items-start gap-3 p-4 rounded-sm border border-border hover:border-foreground cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={checks[key]}
              onChange={() => handleToggle(key)}
              className="w-5 h-5 rounded-sm accent-accent mt-0.5"
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!allChecked}
        className="w-full px-6 py-3 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Step3ModularConsent({ onContinue }) {
  const [consents, setConsents] = useState({
    dataProcessing: true,
    modelImprovement: false,
  });

  const handleToggle = (key) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Control Your Data</h2>
        <p className="text-secondary">Choose what you consent to</p>
      </div>

      <div className="space-y-4">
        {[
          {
            key: 'dataProcessing',
            label: 'Data Processing',
            desc: 'Required to run HEX6. Your inputs and market data are processed to generate analysis.',
            required: true,
          },
          {
            key: 'modelImprovement',
            label: 'Model Improvement',
            desc: 'Optional. Anonymized patterns from your sessions help improve HEX6\'s accuracy over time.',
            required: false,
          },
        ].map(({ key, label, desc, required }) => (
          <div
            key={key}
            className="p-4 rounded-sm border border-border space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium flex items-center gap-2">
                  {label}
                  {required && <span className="text-xs text-accent font-bold">REQUIRED</span>}
                </p>
                <p className="text-sm text-secondary mt-1">{desc}</p>
              </div>
              <input
                type="checkbox"
                checked={consents[key]}
                onChange={() => !required && handleToggle(key)}
                disabled={required}
                className="w-5 h-5 rounded-sm accent-accent mt-1"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onContinue}
        className="w-full px-6 py-3 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function Step4LegalAcceptance({ onContinue }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Terms & Conditions</h2>
        <p className="text-secondary">Read and accept</p>
      </div>

      <div className="p-6 rounded-sm border border-border bg-muted space-y-4 max-h-96 overflow-y-auto">
        <h3 className="font-bold">System Definition</h3>
        <p className="text-sm text-secondary leading-relaxed">
          HEX6 is a probabilistic computational system that analyzes market data to generate exposure fields. It is not an investment advisor, broker, or fiduciary service.
        </p>

        <h3 className="font-bold pt-4">No Advisory Services</h3>
        <p className="text-sm text-secondary leading-relaxed">
          All outputs are informational only. HEX6 does not provide investment recommendations, financial advice, or portfolio management services. You are solely responsible for all financial decisions.
        </p>

        <h3 className="font-bold pt-4">Risk Acknowledgment</h3>
        <p className="text-sm text-secondary leading-relaxed">
          Model outputs may be incorrect. Market conditions change. Historical performance does not guarantee future results. You assume all risk of financial loss.
        </p>

        <h3 className="font-bold pt-4">Data & Usage</h3>
        <p className="text-sm text-secondary leading-relaxed">
          You retain ownership of your inputs. HEX6 and its creators retain all rights to the model, algorithms, and signals. System outputs may be used for model improvement unless you opt out.
        </p>

        <h3 className="font-bold pt-4">Compliance</h3>
        <p className="text-sm text-secondary leading-relaxed">
          You are responsible for compliance with all applicable laws in your jurisdiction. HEX6 is not registered with any financial authority and offers no regulatory protection.
        </p>
      </div>

      <label className="flex items-start gap-3 p-4 rounded-sm border border-border">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="w-5 h-5 rounded-sm accent-accent mt-0.5"
        />
        <span className="text-sm">
          I accept the HEX6 Terms of Use, Privacy Policy, and Risk Disclosure
        </span>
      </label>

      <button
        onClick={onContinue}
        disabled={!agreed}
        className="w-full px-6 py-3 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        Enter System <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ConsentFlow({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep === STEPS.length - 1) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const step = STEPS[currentStep];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Progress bar */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">HEX6 Setup</h1>
            <span className="text-sm text-secondary">
              Step {currentStep + 1} of {STEPS.length}
            </span>
          </div>
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center max-w-4xl mx-auto w-full px-6 py-12">
        {currentStep === 0 && <Step1SystemFraming onContinue={handleNext} />}
        {currentStep === 1 && <Step2RiskAcknowledgment onContinue={handleNext} />}
        {currentStep === 2 && <Step3ModularConsent onContinue={handleNext} />}
        {currentStep === 3 && <Step4LegalAcceptance onContinue={handleNext} />}
      </div>

      {/* Footer */}
      <div className="border-t border-border py-4">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs text-secondary">
            Your consent is recorded and stored securely. You can manage preferences anytime in Settings.
          </p>
        </div>
      </div>
    </div>
  );
}