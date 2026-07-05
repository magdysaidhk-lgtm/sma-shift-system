import type { ShiftType } from '../types/domain'

interface Props {
  open: boolean
  title: string
  shiftTypes: ShiftType[]
  currentCode: string | undefined
  onSelect: (code: string | null) => void
  onClose: () => void
}

export default function CellEditModal({ open, title, shiftTypes, currentCode, onSelect, onClose }: Props) {
  return (
    <div className={`modal-backdrop no-print ${open ? 'show' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <strong>{title}</strong>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="chip-grid">
          <button className="chip-option clear" onClick={() => onSelect(null)}>
            بدون شيفت<span className="sub">مسح الخانة</span>
          </button>
          {shiftTypes.map((s) => (
            <button
              key={s.code}
              className={`chip-option ${currentCode === s.code ? 'active' : ''}`}
              style={{ background: s.color, color: s.textColor }}
              onClick={() => onSelect(s.code)}
            >
              {s.code}
              <span className="sub">{s.description}{s.needsConfirmation ? ' — محتاج تأكيد' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
