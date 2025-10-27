import React, { useState } from 'react';
import './Dashboard.css';

function Dashboard() {
  const [notes, setNotes] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Dummy initial example notes (remove when connect to backend)
  // useEffect(() => setNotes([{ id: 1, title: 'Sample Note', content: 'This is a sample note.' }]), []);

  const handleAddNote = () => {
    if (!title.trim()) return;
    if (editingId) {
      setNotes(notes.map(note => (note.id === editingId ? { id: editingId, title, content } : note)));
      setEditingId(null);
    } else {
      setNotes([...notes, { id: Date.now(), title, content }]);
    }
    setTitle('');
    setContent('');
  };

  const handleEdit = (note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleDelete = (id) => {
    setNotes(notes.filter(note => note.id !== id));
  };

  return (
    <div className="dashboard-container">
      <h1>User Notes Dashboard</h1>

      <div className="form-group">
        <input
          placeholder="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          maxLength={50}
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          maxLength={500}
        />
        <button onClick={handleAddNote}>
          {editingId ? 'Update Note' : 'Add Note'}
        </button>
      </div>

      <div className="notes-list">
        {notes.length === 0 && <p className="empty">No notes yet. Add some!</p>}
        {notes.map(note => (
          <div key={note.id} className="note-card">
            <h3>{note.title}</h3>
            <p>{note.content}</p>
            <div className="note-actions">
              <button onClick={() => handleEdit(note)}>Edit</button>
              <button onClick={() => handleDelete(note.id)} className="delete-button">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Dashboard;
