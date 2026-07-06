import type { CSSProperties } from 'react'
import type { Employee } from '../types/domain'

interface Props {
  id: string
  employees: Employee[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  style?: CSSProperties
}

/**
 * A text input backed by a <datalist> of employee names — typing shows a
 * native dropdown of matches (like a searchable combobox), but it still
 * behaves as free-text substring search underneath, so partial names work.
 */
export default function NameSearchInput({ id, employees, value, onChange, placeholder, style }: Props) {
  return (
    <>
      <input
        type="text"
        list={id}
        placeholder={placeholder ?? 'اسم الموظف...'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={style}
      />
      <datalist id={id}>
        {employees.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>
    </>
  )
}
