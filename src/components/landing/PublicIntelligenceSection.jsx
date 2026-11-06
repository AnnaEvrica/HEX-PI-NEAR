import React, { useState } from 'react';
import ContactModal from './ContactModal';
import './public-intelligence.css';

const pilots = [
  { number: '01', title: 'Air quality', description: 'Investigate the probability of AQI threshold exceedances and changing particulate conditions using public observations and forecast data.', question: 'Will AQI exceed a defined threshold in the next 48 hours?' },
  { number: '02', title: 'Flood & coastal conditions', description: 'Evaluate probabilistic signals from rainfall, stream gauges and coastal water levels alongside official forecasts.', question: 'Will a monitored gauge cross a defined threshold?' },
  { number: '03', title: 'Heat & temperature', description: 'Extend existing temperature-series research toward measurable local heat events, with external validation.', question: 'Will a station exceed a specified temperature threshold?' },
  { number: '04', title: 'Watersheds & anomaly detection', description: 'Explore unusual changes in measured water conditions and help volunteer observers prioritize what deserves review.', question: 'Is this reading unusual against its own historical baseline?' }
];

const steps = [
  ['Define', 'Choose one measurable event, one location, and a forecast horizon.'],
  ['Forecast', 'Record probabilities and baseline odds before the outcome exists.'],
  ['Verify', 'Match forecasts to observations; expose misses as well as hits.'],
  ['Learn', 'Score performance, examine calibration, and update only from completed outcomes.']
];

export default function PublicIntelligenceSection() {
  const [contactOpen, setContactOpen] = useState(false);
  return (
    <section className="lp-public-section" id="public-intelligence" aria-labelledby="public-intelligence-heading">
      <div className="lp-public-inner">
        <div className="lp-public-eyebrow">OPEN INITIATIVE · PROPOSED PILOTS</div>
        <div className="lp-public-intro">
          <div>
            <h2 id="public-intelligence-heading">HEX EARTH<span className="lp-public-dot">.</span></h2>
            <p className="lp-public-lead">Probabilistic intelligence, put to public use.</p>
          </div>
          <p className="lp-public-overview">We want to volunteer measurable forecasting and early-signal analysis to environmental researchers, local resilience groups, and mission-driven organizations. Start with public data. Publish predictions before outcomes. Measure what HEX adds beyond the baseline.</p>
        </div>
        <div className="lp-public-quote">Not certainty. <em>Accountable foresight.</em></div>
        <div className="lp-public-grid">
          {pilots.map(p => <article className="lp-public-card" key={p.number}>
            <span className="lp-public-number">{p.number} / PILOT AREA</span>
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <div className="lp-public-question"><span>TESTABLE QUESTION</span>{p.question}</div>
          </article>)}
        </div>
        <div className="lp-public-method">
          <div>
            <div className="lp-public-eyebrow">THE PUBLIC FORECAST LEDGER</div>
            <h3>Make a claim.<br /><em>Let reality score it.</em></h3>
            <p>Each proposed pilot should publish a timestamped event definition, horizon, HEX probability, baseline probability, eventual observation, and performance score. Evaluation should include calibration, missing data, comparisons to existing public forecasts where appropriate, and failures—not only successes.</p>
            <p className="lp-public-note">Prior HEX research includes historical temperature-series evaluation. That does not establish performance for air quality, flood, smoke or water-quality predictions. Those applications remain research proposals until separately validated.</p>
          </div>
          <ol className="lp-public-steps">
            {steps.map((s, i) => <li key={s[0]}><span>0{i + 1}</span><div><strong>{s[0]}</strong><p>{s[1]}</p></div></li>)}
          </ol>
        </div>
        <div className="lp-public-collaborate">
          <div>
            <div className="lp-public-eyebrow">VOLUNTEER COLLABORATION</div>
            <h3>Have a measurable problem worth solving?</h3>
            <p>We are interested in conversations with nonprofit teams, citizen scientists, watershed groups, climate-resilience programs and public-interest researchers. A small, well-defined pilot with real feedback is the starting point.</p>
            <p className="lp-public-note">Exploratory, pro bono collaboration. No partnership with public agencies or named organizations is implied.</p>
          </div>
          <button type="button" onClick={() => setContactOpen(true)} className="lp-public-contact">Propose a pilot ↗</button>
        </div>
        <p className="lp-public-disclaimer">Experimental research only. HEX EARTH does not issue official forecasts, emergency warnings, public-health advice or safety-critical instructions. Follow NOAA, NWS, EPA and relevant local authorities for official guidance.</p>
      </div>
    {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}
    </section>
  );
}
