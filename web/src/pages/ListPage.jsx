import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, ItemCard, Loading, Score, useApi } from '../components/ui.jsx';

export default function ListPage() {
  const { id } = useParams();
  const state = useApi(`/lists/${id}`);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);

  return (
    <Loading state={state}>
      {({ list, items, isOwner }) => {
        const removeItem = async (itemId) => {
          await api.del(`/lists/${list.id}/items/${itemId}`);
          state.reload();
        };
        const remove = async () => {
          if (!confirm(`Delete "${list.title}"?`)) return;
          await api.del(`/lists/${list.id}`);
          navigate('/lists');
        };
        return (
          <>
            <div className="page-head">
              <div>
                <h1>{list.title}</h1>
                <p className="muted">
                  by <Link to={`/u/${list.owner_username}`}>{list.owner_name}</Link> · {list.visibility} · {items.length} item{items.length === 1 ? '' : 's'}
                </p>
                {list.description && <p>{list.description}</p>}
              </div>
              {isOwner && (
                <div className="row">
                  <button onClick={() => setEditing(!editing)}>Edit</button>
                  <button className="danger" onClick={remove}>Delete</button>
                </div>
              )}
            </div>
            {editing && <EditList list={list} onDone={() => { setEditing(false); state.reload(); }} />}
            {items.length ? (
              <div className="grid">
                {items.map(({ item, note, owner_score }) => (
                  <ItemCard key={item.id} item={item} hideActions>
                    {owner_score != null && <p className="small">{list.owner_name}'s score <Score score={owner_score} /></p>}
                    {note && <p className="desc quote">“{note}”</p>}
                    {isOwner && <button className="ghost small" onClick={() => removeItem(item.id)}>Remove from list</button>}
                  </ItemCard>
                ))}
              </div>
            ) : (
              <Empty>{isOwner ? <>This list is empty. Open any title and use “Add to a list”, or <Link to="/search">search</Link>.</> : 'This list is empty.'}</Empty>
            )}
          </>
        );
      }}
    </Loading>
  );
}

function EditList({ list, onDone }) {
  const [f, setF] = useState({ title: list.title, description: list.description || '', visibility: list.visibility });
  const save = async (e) => {
    e.preventDefault();
    await api.patch(`/lists/${list.id}`, f);
    onDone();
  };
  return (
    <form className="panel form-grid" onSubmit={save}>
      <label>Title<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label>Who can see it
        <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}>
          <option value="friends">Friends</option>
          <option value="public">Everyone</option>
          <option value="private">Just me</option>
        </select>
      </label>
      <label className="span">Description<textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="span"><button className="primary">Save</button></div>
    </form>
  );
}
