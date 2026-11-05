import type { AppSettings, ColorFilter } from '../App'
import type { Chapter, Line } from '../lib/repertoire'
import { isDue, isMastered, type ProgressMap } from '../lib/srs'
import type { QueueItem } from './Trainer'

interface Props {
  chapters: Chapter[]
  activeLines: Line[]
  progress: ProgressMap
  settings: AppSettings
  onSettings: (s: AppSettings) => void
  onTrain: (title: string, queue: QueueItem[]) => void
  onOpenChapter: (id: string) => void
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Home({ chapters, activeLines, progress, settings, onSettings, onTrain, onOpenChapter }: Props) {
  const now = Date.now()
  const filter = settings.colorFilter
  const inFilter = (l: Line) => filter === 'all' || l.color === filter
  const lines = activeLines.filter(inFilter)
  const due = lines.filter((l) => isDue(progress[l.id], now))
  const fresh = lines.filter((l) => !progress[l.id])
  const mastered = lines.filter((l) => isMastered(progress[l.id]))
  const learning = lines.length - fresh.length

  const setFilter = (colorFilter: ColorFilter) => onSettings({ ...settings, colorFilter })

  const startReview = () =>
    onTrain('오늘의 복습', shuffle(due).map((l) => ({ lineId: l.id, mode: 'review' as const })))
  const startLearn = () =>
    onTrain(
      '새 라인 배우기',
      fresh.slice(0, settings.newPerSession).map((l) => ({ lineId: l.id, mode: 'learn' as const })),
    )

  return (
    <div className="home">
      <section className="panel hero">
        <div className="segmented" role="group" aria-label="색 선택">
          {(['all', 'white', 'black'] as const).map((c) => (
            <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
              {c === 'all' ? '전체' : c === 'white' ? '백' : '흑'}
            </button>
          ))}
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-num accent">{due.length}</span>
            <span className="stat-label">오늘 복습</span>
          </div>
          <div className="stat">
            <span className="stat-num">{fresh.length}</span>
            <span className="stat-label">새 라인</span>
          </div>
          <div className="stat">
            <span className="stat-num">
              {mastered.length}
              <small>/{lines.length}</small>
            </span>
            <span className="stat-label">익힌 라인</span>
          </div>
        </div>

        <div className="actions">
          <button className="btn primary big" onClick={startReview} disabled={due.length === 0}>
            복습 시작 {due.length > 0 && `(${due.length})`}
          </button>
          <button className="btn big" onClick={startLearn} disabled={fresh.length === 0}>
            새 라인 {Math.min(settings.newPerSession, fresh.length)}개 배우기
          </button>
        </div>
        {due.length === 0 && learning > 0 && (
          <p className="muted small">오늘 복습할 라인을 모두 끝냈어요. 새 라인을 배우거나 챕터별로 연습해 보세요.</p>
        )}
        {learning === 0 && (
          <p className="muted small">
            처음이라면 <strong>새 라인 배우기</strong>부터 시작하세요. 화살표를 따라 한 번 두고, 바로 화살표 없이 한 번 더
            둡니다. 맞히면 내일 복습 목록에 올라갑니다.
          </p>
        )}
      </section>

      <h3 className="section-title">챕터</h3>
      <div className="chapter-grid">
        {chapters
          .filter((c) => filter === 'all' || c.color === filter)
          .map((c) => {
            const act = c.lines.filter((l) => activeLines.includes(l))
            const m = act.filter((l) => isMastered(progress[l.id])).length
            const started = act.filter((l) => progress[l.id]).length
            const d = act.filter((l) => isDue(progress[l.id], now)).length
            return (
              <button key={c.id} className="chapter-card" onClick={() => onOpenChapter(c.id)}>
                <div className="chapter-top">
                  <span className={`badge badge-${c.color}`}>{c.color === 'white' ? '백' : '흑'}</span>
                  {d > 0 && <span className="badge due">복습 {d}</span>}
                  {c.custom && <span className="badge">직접 추가</span>}
                </div>
                <strong className="chapter-name">{c.name}</strong>
                <span className="muted small">{c.description}</span>
                <div className="progress" aria-label={`${act.length}개 중 ${m}개 익힘`}>
                  <div className="progress-started" style={{ width: pct(started, act.length) }} />
                  <div className="progress-mastered" style={{ width: pct(m, act.length) }} />
                </div>
                <span className="muted small">
                  라인 {act.length}개 · 시작 {started} · 익힘 {m}
                </span>
              </button>
            )
          })}
      </div>
    </div>
  )
}

function pct(n: number, total: number) {
  return total === 0 ? '0%' : `${(n / total) * 100}%`
}
