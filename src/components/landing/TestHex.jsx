import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

// Strip the **Sources:** markdown block the pipeline appends to the answer text
// — the sources are rendered as a collapsible toggle below, not as markdown.
function stripSources(text) {
  if (!text) return text;
  return text.replace(/\n*\*\*Sources:\*\*[\s\S]*$/, '').trim();
}

const CATEGORIES = [
  'Personal Growth',
  'Relationships',
  'Health & Wellness',
  'Career',
  'Technology',
  'Predictions',
];

const BOOK_WIDTHS = [90, 84, 94, 86, 92, 82];

export default function TestHex() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const [showSources, setShowSources] = useState(false);

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
    setShowSources(false);
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

  const selectBook = (prompt) => {
    setSelected(selected?.category === prompt.category ? null : prompt);
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

      {/* Category books — stacked horizontally, animated */}
      <div className="lp-books-shelf">
        {loading ? (
          CATEGORIES.map((cat, i) => (
            <div
              key={cat}
              className="lp-book lp-book-skel"
              style={{ width: `${BOOK_WIDTHS[i]}%` }}
            />
          ))
        ) : (
          prompts.map((p, i) => (
            <button
              key={p.category || i}
              className={`lp-book ${selected?.category === p.category ? 'lp-book-active' : ''}`}
              style={{ width: `${BOOK_WIDTHS[i % BOOK_WIDTHS.length]}%` }}
              onClick={() => selectBook(p)}
              disabled={asking}
            >
              <span className="lp-book-label">{p.category}</span>
            </button>
          ))
        )}
      </div>

      {/* Selected trending question */}
      {selected && (
        <div className="lp-trending-prompt">
          <div className="lp-trending-source">{selected.trending_source}</div>
          <p className="lp-trending-question">{selected.prompt}</p>
          <button
            className="lp-trending-ask"
            onClick={() => ask(selected.prompt)}
            disabled={asking}
          >
            {asking && question === selected.prompt ? 'Thinking...' : 'Ask Hex this question'}
          </button>
        </div>
      )}

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
          <p className="lp-ask-result-text">{stripSources(answer.answer)}</p>
          {answer.sources && answer.sources.length > 0 && (
            <div className="lp-ask-sources">
              <button
                className="lp-ask-sources-toggle"
                onClick={() => setShowSources(!showSources)}
              >
                {showSources ? 'Hide sources' : 'Sources'}
              </button>
              {showSources && (
                <>
                  {answer.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="lp-ask-source-link">
                      {s.name}
                    </a>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}