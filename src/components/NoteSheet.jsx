import { useState } from 'react';
import Sheet from './Sheet';

/** 강좌 하나에 붙이는 메모 */
export default function NoteSheet({ title, note, onSave, onClose }) {
  const [text, setText] = useState(note?.text ?? '');
  const save = () => {
    const t = text.trim();
    onSave(t ? { text: t } : null);
    onClose();
  };
  return (
    <Sheet
      title="메모"
      onClose={onClose}
      footer={
        <div className="note-actions">
          <button className="primary" onClick={save}>저장</button>
          {note && <button className="outline" onClick={() => { onSave(null); onClose(); }}>지우기</button>}
          <button className="outline" onClick={onClose}>닫기</button>
        </div>
      }
    >
      <p className="note-title">{title}</p>
      <label className="note-field">
        메모
        <textarea
          value={text}
          maxLength={300}
          rows={4}
          placeholder="예) 친구랑 같이 신청 / 토요일 오전만 가능"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
    </Sheet>
  );
}
