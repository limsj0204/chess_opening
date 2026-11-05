import { useMemo, useState } from 'react'
import { movesToPgn, movesToText, normalizeMoves, parsePgnLines, PgnError, type ParsedMove } from '../lib/pgn'
import { findConflicts, type Chapter, type CustomChapter, type CustomLine, type Line } from '../lib/repertoire'
import type { Color } from '../lib/types'

interface Props {
  chapters: Chapter[]
  activeLines: Line[]
  defaultChapterId?: string
  onSave: (newChapter: CustomChapter | null, lines: CustomLine[]) => void
  onCancel: () => void
}

const NEW = '__new__'

const EXAMPLE = `1.e4 c5 2.Nf3 d6 (2...Nc6 3.Bb5) 3.Bb5+ Bd7 4.Bxd7+ Qxd7 {Lichess 스터디에서 내보낸 PGN도 붙여 넣을 수 있어요.}`

export function AddLine({ chapters, activeLines, defaultChapterId, onSave, onCancel }: Props) {
  const [chapterId, setChapterId] = useState(defaultChapterId ?? chapters[0]?.id ?? NEW)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<Color>('white')
  const [name, setName] = useState('')
  const [pgn, setPgn] = useState('')

  const isNew = chapterId === NEW
  const color: Color = isNew ? newColor : (chapters.find((c) => c.id === chapterId)?.color ?? 'white')

  const preview = useMemo(() => {
    if (!pgn.trim()) return null
    try {
      const parsed = parsePgnLines(pgn).map(normalizeMoves)
      if (parsed.length === 0) return { error: '수를 찾지 못했습니다.' }
      const existing = new Set(activeLines.filter((l) => l.color === color).map((l) => sansKey(l.moves)))
      const unique: ParsedMove[][] = []
      const seen = new Set<string>()
      let duplicates = 0
      for (const moves of parsed) {
        const key = sansKey(moves)
        if (existing.has(key) || seen.has(key)) duplicates++
        else {
          seen.add(key)
          unique.push(moves)
        }
      }
      const temp: Line[] = unique.map((moves, i) => ({
        id: `__preview_${i}`,
        name: '',
        chapterId: 'preview',
        color,
        moves,
        custom: true,
      }))
      const conflicts = findConflicts([...activeLines, ...temp]).filter(
        (c) => c.b.lineId.startsWith('__preview') || c.a.lineId.startsWith('__preview'),
      )
      return { lines: unique, duplicates, conflicts }
    } catch (e) {
      return { error: e instanceof PgnError ? e.message : 'PGN을 읽지 못했습니다.' }
    }
  }, [pgn, color, activeLines])

  const canSave =
    !!preview && !('error' in preview) && preview.lines.length > 0 && preview.conflicts.length === 0 &&
    (!isNew || newName.trim().length > 0)

  function save() {
    if (!preview || 'error' in preview) return
    const stamp = Date.now().toString(36)
    let chapter: CustomChapter | null = null
    let targetId = chapterId
    if (isNew) {
      targetId = `c-ch-${stamp}`
      chapter = { id: targetId, name: newName.trim(), color: newColor, description: '직접 추가한 챕터' }
    }
    const base = name.trim()
    const lines: CustomLine[] = preview.lines.map((moves, i) => ({
      id: `c-${stamp}-${i}`,
      chapterId: targetId,
      name: base ? (preview.lines.length > 1 ? `${base} (${i + 1})` : base) : shortName(moves),
      pgn: movesToPgn(moves),
    }))
    onSave(chapter, lines)
  }

  const lineName = (id: string) => activeLines.find((l) => l.id === id)?.name ?? '새 라인'

  return (
    <section className="panel form">
      <h2>라인 추가</h2>
      <p className="muted">
        PGN이나 수순(예: <code>1.e4 e5 2.Nf3</code>)을 붙여 넣으세요. 괄호 변화 <code>( )</code>가 있으면 라인이 자동으로
        나뉘고, <code>{'{ }'}</code> 안의 글은 설명으로 저장됩니다.
      </p>

      <label>
        챕터
        <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.color === 'white' ? '백' : '흑'}] {c.name}
            </option>
          ))}
          <option value={NEW}>+ 새 챕터 만들기</option>
        </select>
      </label>

      {isNew && (
        <div className="row">
          <label className="grow">
            새 챕터 이름
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 시실리안 상대하기" />
          </label>
          <label>
            내 색
            <select value={newColor} onChange={(e) => setNewColor(e.target.value as Color)}>
              <option value="white">백</option>
              <option value="black">흑</option>
            </select>
          </label>
        </div>
      )}

      <label>
        라인 이름 (비워 두면 수순으로 자동 생성)
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 2...d6 3.Bb5+" />
      </label>

      <label>
        PGN / 수순
        <textarea rows={6} value={pgn} onChange={(e) => setPgn(e.target.value)} placeholder={EXAMPLE} />
      </label>

      {preview && 'error' in preview && <p className="message wrong">{preview.error}</p>}
      {preview && !('error' in preview) && (
        <div className="preview">
          <p>
            추가할 라인 <strong>{preview.lines.length}</strong>개
            {preview.duplicates > 0 && <span className="muted"> (이미 있는 라인 {preview.duplicates}개는 건너뜀)</span>}
          </p>
          <ul className="small">
            {preview.lines.slice(0, 8).map((m, i) => (
              <li key={i}>{movesToText(m.map((x) => x.san))}</li>
            ))}
            {preview.lines.length > 8 && <li>…</li>}
          </ul>
          {preview.conflicts.map((c, i) => (
            <p key={i} className="message wrong">
              충돌: 같은 포지션({c.moveText})에서 「{lineName(c.a.lineId)}」은(는) {c.a.san}, 새 라인은 {c.b.san}을(를)
              둡니다. 한 포지션에는 내 수가 하나만 있어야 해요.
            </p>
          ))}
        </div>
      )}

      <div className="actions">
        <button className="btn primary" onClick={save} disabled={!canSave}>
          저장
        </button>
        <button className="btn ghost" onClick={onCancel}>
          취소
        </button>
      </div>
    </section>
  )
}

function sansKey(moves: ParsedMove[]) {
  return moves.map((m) => m.san).join(' ')
}

function shortName(moves: ParsedMove[]) {
  const text = movesToText(moves.map((m) => m.san))
  return text.length > 40 ? `…${text.slice(-38)}` : text
}
