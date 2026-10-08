import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { Cover, Loading, MEDIA, ScorePicker, useApi } from '../components/ui.jsx';

// Cold start: pick genres and moods, then rate a few well-known titles.
export default function Onboarding() {
  const state = useApi('/onboarding/starters');
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [tags, setTags] = useState(new Set());
  const [ratings, setRatings] = useState({});
  const [busy, setBusy] = useState(false);

  const toggle = (t) => {
    const next = new Set(tags);
    next.has(t) ? next.delete(t) : next.add(t);
    setTags(next);
  };

  const finish = async () => {
    setBusy(true);
    await api.post('/onboarding', {
      tags: [...tags],
      ratings: Object.entries(ratings).filter(([, s]) => s).map(([itemId, score]) => ({ itemId: Number(itemId), score })),
    });
    await refresh();
    navigate('/');
  };

  return (
    <Loading state={state}>
      {({ starters, genres, moods }) => (
        <div className="onboarding">
          <div className="steps">
            <span className={step === 0 ? 'on' : ''}>1 · What you're into</span>
            <span className={step === 1 ? 'on' : ''}>2 · Rate a few</span>
          </div>

          {step === 0 && (
            <>
              <h1>What are you into?</h1>
              <p className="muted">Pick as many as you like, in any medium. You can change these later in Taste DNA.</p>
              {Object.entries(genres).map(([medium, list]) => (
                <section key={medium}>
                  <h3>{MEDIA[medium].icon} {MEDIA[medium].plural}</h3>
                  <div className="chips">
                    {list.map((g) => (
                      <button key={g} className={`chip ${tags.has(`genre:${g}`) ? 'on' : ''}`} onClick={() => toggle(`genre:${g}`)}>{g}</button>
                    ))}
                  </div>
                </section>
              ))}
              <section>
                <h3>✨ Moods: the feeling you go looking for</h3>
                <div className="chips">
                  {moods.map((m) => (
                    <button key={m} className={`chip mood ${tags.has(`mood:${m}`) ? 'on' : ''}`} onClick={() => toggle(`mood:${m}`)}>{m}</button>
                  ))}
                </div>
              </section>
              <div className="footer-actions">
                <button className="primary" onClick={() => setStep(1)} disabled={!tags.size}>Next →</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1>Rate anything you know</h1>
              <p className="muted">Skip anything you haven't seen, read or heard. Low scores help as much as high ones.</p>
              {Object.entries(starters).map(([medium, items]) => (
                <section key={medium}>
                  <h3>{MEDIA[medium].icon} {MEDIA[medium].plural}</h3>
                  <div className="starter-grid">
                    {items.map((item) => (
                      <div key={item.id} className="starter">
                        <Cover item={item} />
                        <div>
                          <b>{item.title}</b>
                          <div className="muted small">{[item.creators[0], item.year].filter(Boolean).join(' · ')}</div>
                          <ScorePicker compact value={ratings[item.id] ?? null} onChange={(s) => setRatings({ ...ratings, [item.id]: s })} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <div className="footer-actions">
                <button onClick={() => setStep(0)}>← Back</button>
                <button className="primary" disabled={busy} onClick={finish}>
                  Show me recommendations ({Object.values(ratings).filter(Boolean).length} rated)
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Loading>
  );
}
