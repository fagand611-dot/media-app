import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Icon, { SAVE_ICON } from '../components/Icon.jsx';
import { useActions } from '../components/actions.jsx';
import { Empty, Loading, PageHead, useApi } from '../components/ui.jsx';

export const SOURCE_LABEL = { spotify: 'Spotify', instagram: 'Instagram', google_maps: 'Google Maps', pinterest: 'Pinterest', manual: 'Added here', tastemate: 'Saved in Next' };
const KIND_LABEL = { song: 'Songs', place: 'Places', look: 'Looks', product: 'Products', art: 'Art', food: 'Food', event: 'Events', other: 'Other' };

// How to get each export. None of these apps let another app read your saves
// directly, but all of them let you download your own data.
const IMPORTS = [
  { source: 'spotify', icon: 'music', how: 'Spotify → Account → Privacy → Download your data. Upload YourLibrary.json, or paste “Artist - Song” lines.' },
  { source: 'instagram', icon: 'image', how: 'Accounts Centre → Download your information → JSON. Upload saved_collections.json (or saved_posts.json). Collection names matter most.' },
  { source: 'google_maps', icon: 'pin', how: 'Google Takeout → Saved (Maps). Upload “Saved Places.json” or a list’s CSV.' },
  { source: 'pinterest', icon: 'bookmark', how: 'Paste pin titles or board names, one per line.' },
];

// Your saves from every app in one place, the patterns that run across
// them, and the tools to import, add and retag.
export default function Saves() {
  const saves = useApi('/saves');
  const graph = useApi('/graph');
  const [filter, setFilter] = useState({ kind: null, source: null, tag: null });
  const reload = () => {
    saves.reload();
    graph.reload();
  };

  return (
    <>
      <PageHead title="Your saves" intro="Songs, places, looks and finds from all your apps, in one place. The patterns across them drive Next.">
        <Link to="/next" className="btn btn-primary">See what’s next <Icon name="arrow" size={18} /></Link>
      </PageHead>

      <Loading state={graph}>{(g) => <Graph g={g} onTag={(tag) => setFilter((f) => ({ ...f, tag: f.tag === tag ? null : tag }))} active={filter.tag} />}</Loading>

      <div className="saves-tools">
        <Importer onDone={reload} />
        <AddSave onDone={reload} />
      </div>

      <Loading state={saves}>
        {(d) => <SaveList data={d} filter={filter} setFilter={setFilter} onChange={reload} />}
      </Loading>
    </>
  );
}

function Graph({ g, onTag, active }) {
  if (!g.total) return <Empty>No saves yet. Import from an app below to see your taste graph.</Empty>;
  const max = g.tags[0]?.weight || 1;
  return (
    <section className="graph">
      {g.patterns.length > 0 && (
        <>
          <h2><Icon name="graph" /> Your taste clusters</h2>
          <p className="muted small">Read from everything you saved, not just what’s labelled: what says it outright, what means it, and what could be it.</p>
          <div className="patterns">
            {g.patterns.map((p) => <Cluster key={p.tags.join()} p={p} />)}
          </div>
        </>
      )}
      <div className="cloud" aria-label="Your strongest tags">
        {g.tags.map((t) => (
          <button key={t.tag} className={`cloud-tag ${active === t.tag ? 'on' : ''}`} style={{ '--w': 0.8 + (t.weight / max) * 0.7 }} onClick={() => onTag(t.tag)}>
            {t.tag}
          </button>
        ))}
      </div>
      {g.untagged > 0 && <p className="muted small">{g.untagged} saves have no tags yet. Add a few below so they count.</p>}
    </section>
  );
}

const TIERS = [
  ['obvious', 'Obvious', 'Says it outright'],
  ['translated', 'Translated', 'Means it without saying it'],
  ['possible', 'Could be', 'Goes with it, or matches your habits'],
];

/** One cluster: its tags, where it shows up, and the evidence in three tiers. */
function Cluster({ p }) {
  const [open, setOpen] = useState(false);
  const seed = p.tags[0];
  return (
    <article className="pattern">
      <h3>{p.tags.join(' · ')}</h3>
      <p className="muted small">
        {Object.entries(p.kinds).map(([k, n]) => `${n} ${KIND_LABEL[k].toLowerCase()}`).join(', ')}
        {' '}from {Object.keys(p.sources).map((s) => SOURCE_LABEL[s]).join(', ')}
      </p>
      <div className="tier-bar" aria-label={`Evidence for ${seed}`}>
        {TIERS.map(([k, label]) => p.tiers[k].length > 0 && (
          <span key={k} className={`tier tier-${k}`} style={{ flex: p.tiers[k].length }}>{p.tiers[k].length} {label.toLowerCase()}</span>
        ))}
      </div>
      <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide' : 'Why'} {seed}? <Icon name={open ? 'up' : 'down'} size={14} />
      </button>
      {open && TIERS.map(([k, label, hint]) => p.tiers[k].length > 0 && (
        <div key={k} className="tier-list">
          <span className={`tier-label tier-${k}`}>{label}</span> <span className="muted small">{hint}</span>
          <ul>
            {p.tiers[k].map((e) => (
              <li key={e.id}>
                <Icon name={SAVE_ICON[e.kind]} size={14} /> <b>{e.title}</b>
                {e.via && <span className="muted"> · {viaText(e.via)}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </article>
  );
}

// A bare keyword ("listening bar") reads better quoted.
const viaText = (via) => (/[→“]| often | your /.test(via) ? via : `says “${via}”`);

function Importer({ onDone }) {
  const [source, setSource] = useState('spotify');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const info = IMPORTS.find((i) => i.source === source);

  const send = async (content) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.post('/saves/import', { source, text: content });
      setMsg(`Found ${r.found}, added ${r.added}${r.skipped ? ` (${r.skipped} already here)` : ''}.${r.untagged ? ` ${r.untagged} need tags.` : ''}`);
      setText('');
      onDone();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 8e6) return setMsg('That file is over 8 MB. Pick the saves file from inside the export, not the whole archive.');
    send(await file.text());
  };

  return (
    <section className="panel">
      <h2><Icon name="upload" /> Import</h2>
      <div className="seg seg-full" role="tablist" aria-label="App">
        {IMPORTS.map((i) => (
          <button key={i.source} role="tab" aria-selected={source === i.source} className={source === i.source ? 'on' : ''} onClick={() => setSource(i.source)}>
            <Icon name={i.icon} size={15} /> <span>{SOURCE_LABEL[i.source]}</span>
          </button>
        ))}
      </div>
      <p className="muted small">{info.how}</p>
      <div className="row">
        <label className="btn btn-outline file-btn">
          <Icon name="upload" size={16} /> Choose file
          <input type="file" accept=".json,.csv,.txt" onChange={onFile} disabled={busy} hidden />
        </label>
        <span className="muted small">or paste below</span>
      </div>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={source === 'spotify' ? 'Miles Davis - So What' : source === 'pinterest' ? 'Minimal wool coat outfit' : 'Paste the file contents'} />
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={() => send(text)}>Import</button>
        {msg && <span className="small">{msg}</span>}
      </div>
    </section>
  );
}

function AddSave({ onDone }) {
  const empty = { title: '', kind: '', city: '', url: '', note: '' };
  const [f, setF] = useState(empty);
  const { toast } = useActions();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    await api.post('/saves', { ...f, kind: f.kind || undefined });
    toast(`Saved ${f.title}`);
    setF(empty);
    onDone();
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2><Icon name="plus" /> Add one</h2>
      <p className="muted small">Heard a song on the street, walked past a bakery? Tags are added from the words you use.</p>
      <input required placeholder="e.g. Tiny natural wine bar, candlelit" value={f.title} onChange={set('title')} />
      <div className="form-row">
        <select value={f.kind} onChange={set('kind')} aria-label="Kind">
          <option value="">Kind: guess</option>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input placeholder="City" value={f.city} onChange={set('city')} />
      </div>
      <input placeholder="Link (optional)" value={f.url} onChange={set('url')} />
      <input placeholder="Note (optional)" value={f.note} onChange={set('note')} />
      <button className="btn btn-primary btn-sm" disabled={!f.title.trim()}>Save</button>
    </form>
  );
}

function SaveList({ data, filter, setFilter, onChange }) {
  const list = data.saves.filter(
    (s) => (!filter.kind || s.kind === filter.kind) && (!filter.source || s.source === filter.source) && (!filter.tag || s.tags.includes(filter.tag))
  );
  const chip = (key, value, label, n) => (
    <button key={value ?? 'all'} className={`chip ${filter[key] === value ? 'on' : ''}`} onClick={() => setFilter((f) => ({ ...f, [key]: value }))}>
      {label}{n != null && <span className="muted"> {n}</span>}
    </button>
  );
  return (
    <section className="shelf-section">
      <div className="shelf-head"><h2>All saves <span className="muted">{data.saves.length}</span></h2></div>
      <div className="chips">
        {chip('kind', null, 'Everything')}
        {Object.entries(data.counts.kind).map(([k, n]) => chip('kind', k, KIND_LABEL[k], n))}
      </div>
      <div className="chips">
        {chip('source', null, 'All apps')}
        {Object.entries(data.counts.source).map(([k, n]) => chip('source', k, SOURCE_LABEL[k], n))}
        {filter.tag && <button className="chip on" onClick={() => setFilter((f) => ({ ...f, tag: null }))}>#{filter.tag} <Icon name="x" size={14} /></button>}
      </div>
      {list.length ? <ul className="save-list">{list.map((s) => <SaveRow key={s.id} save={s} onChange={onChange} />)}</ul> : <Empty>Nothing here.</Empty>}
    </section>
  );
}

function SaveRow({ save, onChange }) {
  const [editing, setEditing] = useState(false);
  const [tags, setTags] = useState(save.tags.join(', '));
  const commit = async () => {
    await api.patch(`/saves/${save.id}`, { tags: tags.split(',') });
    setEditing(false);
    onChange();
  };
  const remove = async () => {
    await api.del(`/saves/${save.id}`);
    onChange();
  };
  return (
    <li className="save-row">
      <span className="save-icon"><Icon name={SAVE_ICON[save.kind]} size={18} /></span>
      <div className="save-main">
        <b>{save.url ? <a href={save.url} target="_blank" rel="noreferrer">{save.title}</a> : save.title}</b>
        <span className="muted small">{[save.creator && !save.title.includes(save.creator) && save.creator, SOURCE_LABEL[save.source], save.collection, save.city].filter(Boolean).join(' · ')}</span>
        {editing ? (
          <div className="row">
            <input autoFocus value={tags} onChange={(e) => setTags(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && commit()} placeholder="jazz, intimate, moody" aria-label="Tags, comma separated" />
            <button className="btn btn-sm btn-primary" onClick={commit}>Done</button>
          </div>
        ) : (
          <div className="tags">
            {save.tags.map((t) => <span key={t} className="tag">{t}</span>)}
            <button className="tag tag-edit" onClick={() => setEditing(true)}>{save.tags.length ? 'Edit tags' : '+ Add tags'}</button>
          </div>
        )}
      </div>
      <button className="icon-btn" aria-label={`Delete ${save.title}`} onClick={remove}><Icon name="x" size={16} /></button>
    </li>
  );
}
