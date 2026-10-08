import { useState } from 'react';
import { api } from '../api.js';
import { Loading, MEDIA, useApi } from '../components/ui.jsx';

export function TagCloud({ tags, onPick }) {
  if (!tags?.length) return <p className="muted">Not enough ratings yet.</p>;
  const max = Math.max(...tags.map((t) => Math.abs(t.weight)));
  return (
    <div className="tag-cloud">
      {tags.map((t) => (
        <span
          key={t.tag}
          className={`tag ${t.kind} ${t.weight < 0 ? 'neg' : ''}`}
          style={{ fontSize: `${0.8 + (Math.abs(t.weight) / max) * 0.7}rem` }}
          title={`${t.kind} · ${t.weight}`}
          onClick={onPick ? () => onPick(t) : undefined}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

export default function Taste() {
  const state = useApi('/taste');
  const tax = useApi('/taxonomy');
  const [kind, setKind] = useState('mood');

  const setPref = async (tag, weight) => {
    await api.put('/taste/tags', { tag, weight });
    state.reload();
  };

  return (
    <Loading state={state}>
      {({ likes, dislikes, prefs, counts }) => {
        const prefMap = new Map(prefs.map((p) => [p.tag, p.weight]));
        const options = !tax.data ? [] : kind === 'mood' ? tax.data.moods : [...new Set(Object.values(tax.data.genres).flat())];
        return (
          <>
            <h1>🧬 Your Taste DNA</h1>
            <p className="muted">
              Built from {counts.rated} ratings ({Object.entries(counts.byMedium).map(([m, n]) => `${n} ${MEDIA[m].plural.toLowerCase()}`).join(', ')}), your wants and skips, and the tags you've pinned.
              Larger tags carry more weight in your recommendations.
            </p>
            <div className="item-cols">
              <section className="panel">
                <h2>You're drawn to</h2>
                <TagCloud tags={likes} />
              </section>
              <section className="panel">
                <h2>You tend to avoid</h2>
                <TagCloud tags={dislikes} />
              </section>
            </div>
            <section className="panel">
              <h2>Tune it</h2>
              <p className="muted small">Pin a tag to boost it, or ban it to push it down. This is applied on top of what Tastemate learns from your ratings.</p>
              <div className="tabs">
                <button className={kind === 'mood' ? 'on' : ''} onClick={() => setKind('mood')}>Moods</button>
                <button className={kind === 'genre' ? 'on' : ''} onClick={() => setKind('genre')}>Genres</button>
              </div>
              <div className="tune">
                {options.map((o) => {
                  const tag = `${kind}:${o}`;
                  const w = prefMap.get(tag) || 0;
                  return (
                    <div key={tag} className={`tune-row ${w > 0 ? 'pinned' : w < 0 ? 'banned' : ''}`}>
                      <span>{o}</span>
                      <button className={w > 0 ? 'on' : ''} title="Boost" onClick={() => setPref(tag, w > 0 ? 0 : 2)}>👍</button>
                      <button className={w < 0 ? 'on' : ''} title="Avoid" onClick={() => setPref(tag, w < 0 ? 0 : -2)}>👎</button>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        );
      }}
    </Loading>
  );
}
