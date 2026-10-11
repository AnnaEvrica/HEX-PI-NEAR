import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

export default function TestHex() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);

  const answerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    base44.functions.invoke('landingSignals', {})
      .then((res) => {
        if (cancelled) return;
        setPrompts(res.data?.prompts || []);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const ask = async (q) => {
    const query = q.trim();
    if (!query || asking) return;
    setQuestion(query);
    setAsking(true);
    setAnswer(null);
    try {
      const res = await base44.functions.invoke('landingAsk', { question: query });
      setAnswer(res.data);
    } catch {
      setAnswer({ answer: 'Something went wrong. Please try again.', sources: [] });
    } finally {
      setAsking(false);
      setTimeout(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    ask(question);
  };

  return (
    <div className="lp-test-hex">
      <div className="lp-test-hex-header">
        <div className="lp-section-label">Test Hex</div>
        <h3 className="lp-test-hex-title">Ask a question. Get a real answer.</h3>
        <p className="lp-test-hex-sub">
          Hex pulls live data from the web, weighs the evidence, and answers with sources you can verify.
        </p>
      </div>

      {/* Popular prompts of the day — horizontal scroll */}
      <div className="lp-prompts-scroll">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div className="lp-prompt-card lp-prompt-skel" key={i}>
              <div className="lp-prompt-skel-cat" />
              <div className="lp-prompt-skel-line" />
              <div className="lp-prompt-skel-line w-3/4" />
            </div>
          ))
        ) : (
          prompts.map((p, i) => (
            <button
              key={i}
              className="lp-prompt-card"
              onClick={() => ask(p.prompt)}
              disabled={asking}
            >
              <span className="lp-prompt-cat">{p.category}</span>
              <span className="lp-prompt-text">{p.prompt}</span>
            </button>
          ))
        )}
      </div>

      {/* Ask your own */}
      <form className="lp-ask-form" onSubmit={handleSubmit}>
        <input
          className="lp-ask-input"
          type="text"
          placeholder="Ask Hex anything..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          disabled={asking}
        />
        <button className="lp-ask-btn" type="submit" disabled={asking || !question.trim()}>
          {asking ? 'Thinking...' : 'Ask Hex'}
        </button>
      </form>

      {/* Answer */}
      {answer && (
        <div className="lp-ask-result" ref={answerRef}>
          <p className="lp-ask-result-text">{answer.answer}</p>
          {answer.sources && answer.sources.length > 0 && (
            <div className="lp-ask-sources">
              {answer.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="lp-ask-source-link">
                  {s.name}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}