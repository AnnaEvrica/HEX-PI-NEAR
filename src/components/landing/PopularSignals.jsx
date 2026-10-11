import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function PopularSignals() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke('landingSignals', {})
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const cols = [
    ...(data?.questions || []).map((q) => ({ kind: 'question', ...q })),
    data?.prediction ? { kind: 'prediction', ...data.prediction } : null,
  ].filter(Boolean);

  const skeleton = Array.from({ length: 4 }, (_, i) => ({ kind: 'skeleton', i }));

  return (
    <div className="lp-signals-grid">
      {(loading ? skeleton : cols).map((col, idx) => (
        <div className="lp-signal-card" key={idx}>
          {col.kind === 'skeleton' && (
            <>
              <div className="lp-signal-skel-label" />
              <div className="lp-signal-skel-line w-3/4" />
              <div className="lp-signal-skel-line" />
              <div className="lp-signal-skel-line w-5/6" />
            </>
          )}
          {col.kind === 'question' && (
            <>
              <div className="lp-signal-label">{col.topic}</div>
              <h4 className="lp-signal-q">{col.question}</h4>
              <p className="lp-signal-a">{col.answer}</p>
            </>
          )}
          {col.kind === 'prediction' && (
            <>
              <div className="lp-signal-label">Live prediction</div>
              <h4 className="lp-signal-q">{(col.question || '').slice(0, 120)}{col.question && col.question.length > 120 ? '…' : ''}</h4>
              <div className="lp-signal-prob">
                <span className="lp-signal-prob-num">
                  {col.probability != null ? `${(col.probability * 100).toFixed(0)}%` : '—'}
                </span>
                <span className="lp-signal-prob-dir">{col.direction || ''}</span>
              </div>
              {col.base_rate != null && (
                <p className="lp-signal-a">
                  Usual odds: {(col.base_rate * 100).toFixed(0)}%.
                </p>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}