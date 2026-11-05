import { movesToText } from '../lib/pgn'
import type { Chapter } from '../lib/repertoire'
import { describeDue, type ProgressMap } from '../lib/srs'
import type { QueueItem } from './Trainer'

interface Props {
  chapter: Chapter
  progress: ProgressMap
  disabled: Set<string>
  onBack: () => void
  onTrain: (title: string, queue: QueueItem[]) => void
  onView: (lineId: string) => void
  onToggle: (lineId: string) => void
  onDeleteLine: (lineId: string) => void
  onDeleteChapter: () => void
  onAdd: () => void
}

export function ChapterView(props: Props) {
  const { chapter, progress, disabled, onBack, onTrain, onView, onToggle, onDeleteLine, onDeleteChapter, onAdd } = props
  const now = Date.now()
  const active = chapter.lines.filter((l) => !disabled.has(l.id))
  const fresh = active.filter((l) => !progress[l.id])

  return (
    <div>
      <button className="btn ghost back" onClick={onBack}>
        ← 홈
      </button>
      <section className="panel">
        <div className="trainer-head">
          <span className={`badge badge-${chapter.color}`}>{chapter.color === 'white' ? '백' : '흑'}</span>
          {chapter.custom && <span className="badge">직접 추가</span>}
        </div>
        <h2>{chapter.name}</h2>
        <p className="muted">{chapter.description}</p>
        <div className="actions">
          <button
            className="btn primary"
            disabled={fresh.length === 0}
            onClick={() => onTrain(chapter.name, fresh.map((l) => ({ lineId: l.id, mode: 'learn' as const })))}
          >
            새 라인 배우기 ({fresh.length})
          </button>
          <button
            className="btn"
            disabled={active.length === 0}
            onClick={() => onTrain(chapter.name, active.map((l) => ({ lineId: l.id, mode: 'practice' as const })))}
          >
            전체 연습 ({active.length})
          </button>
          <button className="btn" onClick={onAdd}>
            + 라인 추가
          </button>
          {chapter.custom && (
            <button
              className="btn danger"
              onClick={() => confirm(`「${chapter.name}」 챕터와 라인을 모두 지울까요?`) && onDeleteChapter()}
            >
              챕터 삭제
            </button>
          )}
        </div>
      </section>

      <ul className="line-list">
        {chapter.lines.map((l) => {
          const off = disabled.has(l.id)
          return (
            <li key={l.id} className={`line-item ${off ? 'off' : ''}`}>
              <div className="line-info">
                <strong>{l.name}</strong>
                <span className="muted small mono">{movesToText(l.moves.map((m) => m.san))}</span>
                <span className="small">{off ? '숨김' : describeDue(progress[l.id], now)}</span>
              </div>
              <div className="line-actions">
                <button className="btn small-btn" onClick={() => onView(l.id)}>
                  보기
                </button>
                <button
                  className="btn small-btn"
                  disabled={off}
                  onClick={() => onTrain(chapter.name, [{ lineId: l.id, mode: progress[l.id] ? 'practice' : 'learn' }])}
                >
                  연습
                </button>
                <button
                  className="btn small-btn ghost"
                  onClick={() => onToggle(l.id)}
                  title="숨긴 라인은 복습과 배우기에서 빠집니다"
                >
                  {off ? '다시 사용' : '숨기기'}
                </button>
                {l.custom && (
                  <button
                    className="btn small-btn danger"
                    onClick={() => confirm(`「${l.name}」 라인을 지울까요?`) && onDeleteLine(l.id)}
                  >
                    삭제
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
