import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronRight } from 'lucide-react';

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
        <h2 className="text-2xl font-bold mb-2">System Definition</h2>
        <p className="text-secondary">What HEX6 is and isn't — Read carefully</p>
      </div>

      <div className="space-y-4 p-6 rounded-sm bg-muted border border-border">
        <p className="font-medium">HEX6 BLE is a computational system that:</p>
        <ul className="space-y-2 text-sm text-secondary">
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Analyzes market data to generate probabilistic outcome distributions</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Does NOT provide investment advice, financial recommendations, or fiduciary services</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Does NOT execute trades, manage capital, or guarantee outcomes</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>Generates outputs that are informational and probabilistic, not predictions</span>
          </li>
          <li className="flex gap-3">
            <span className="text-accent font-bold">•</span>
            <span>You are solely responsible for how you interpret and apply any output</span>
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
            label: 'I understand model outputs are experimental and I apply them at my own discretion',
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
    modelTraining: false,
  });

  const handleToggle = (key) => {
    setConsents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Store consent choices
  useEffect(() => {
    localStorage.setItem('hex6_consent_choices', JSON.stringify(consents));
  }, [consents]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Data Processing & Consent</h2>
        <p className="text-secondary">Control your data preferences</p>
      </div>

      <div className="space-y-4">
        {[
          {
            key: 'dataProcessing',
            label: 'Data Processing',
            desc: 'Required to run HEX6 BLE. Your inputs and market queries are processed to generate probabilistic analysis.',
            required: true,
          },
          {
            key: 'modelTraining',
            label: 'Model Training',
            desc: 'Optional. Anonymized patterns from your sessions help improve HEX6\'s accuracy. You can disable this anytime in Settings.',
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

  const handleContinue = () => {
    const timestamp = new Date().toISOString();
    localStorage.setItem('hex6_consent_timestamp', timestamp);
    localStorage.setItem('hex6_consent_version', '1.2');
    onContinue();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Terms & Conditions</h2>
        <p className="text-secondary">Review and accept legal terms</p>
      </div>

      <div className="p-6 rounded-sm border border-border bg-muted space-y-4 max-h-96 overflow-y-auto text-sm">
        <section className="space-y-2">
          <h3 className="font-bold">System Definition</h3>
          <p className="text-secondary leading-relaxed">
            HEX6 BLE is an experimental Probabilistic Intelligence model that generates probabilistic, informational outputs to support enhanced reasoning. It is NOT an investment advisor, broker, fiduciary, or financial institution.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-bold">No Advisory or Predictive Services</h3>
          <p className="text-secondary leading-relaxed">
            All outputs are informational and probabilistic only. HEX6 does not predict markets, provide investment recommendations, financial advice, or portfolio management services. You are solely responsible for how you interpret and apply any output.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-bold">Risk Acknowledgment</h3>
          <p className="text-secondary leading-relaxed">
            HEX6 BLE is an experimental Probabilistic Intelligence model. Outputs may be incorrect or become outdated. Conditions change rapidly and historical patterns do not guarantee future results. The goal is maximum value to you through enhanced reasoning — you apply any output at your own discretion.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-bold">Data Ownership & Usage</h3>
          <p className="text-secondary leading-relaxed">
            You retain ownership of your inputs. Evrica Technologies Inc. retains all rights to the model, algorithms, and outputs. Anonymized patterns may be used for model improvement unless you disable this in Settings.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-bold">Regulatory Compliance</h3>
          <p className="text-secondary leading-relaxed">
            You are responsible for compliance with all applicable laws in your jurisdiction. HEX6 is not registered with any financial authority and offers no regulatory protection. Consult a licensed financial advisor for your specific situation.
          </p>
        </section>

        <section className="space-y-2 border-t border-border pt-4">
          <h3 className="font-bold">Limitation of Liability</h3>
          <p className="text-secondary leading-relaxed">
            To the fullest extent permitted by law, Evrica Technologies Inc. is not liable for any indirect, incidental, special, or consequential damages arising from use of this experimental model.
          </p>
        </section>
      </div>

      <label className="flex items-start gap-3 p-4 rounded-sm border border-border">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="w-5 h-5 rounded-sm accent-accent mt-0.5"
        />
        <span className="text-sm">
          I accept the HEX6 BLE Terms of Use, Privacy Policy, Risk Disclosure, and Regulatory Compliance requirements
        </span>
      </label>

      <button
        onClick={handleContinue}
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
      // Store consent timestamp when user completes onboarding
      localStorage.setItem('hex6_consent_timestamp', new Date().toISOString());
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