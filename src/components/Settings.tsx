import { useRef, useState } from 'react'
import type { AppSettings, SyncStatus } from '../App'
import type { CustomData } from '../lib/repertoire'
import type { ProgressMap } from '../lib/srs'
import { ConfirmButton } from './ConfirmButton'
import { SyncNote } from './Home'

export interface BackupData {
  progress: ProgressMap
  custom: CustomData
  disabled: string[]
}

interface Props {
  sync: SyncStatus
  settings: AppSettings
  onSettings: (s: AppSettings) => void
  data: BackupData
  onImport: (d: BackupData) => void
  onResetProgress: () => void
}

function parseBackup(text: string): BackupData {
  const parsed = JSON.parse(text)
  if (typeof parsed !== 'object' || !parsed || !parsed.progress || !parsed.custom) throw new Error('형식 오류')
  return {
    progress: parsed.progress,
    custom: { chapters: parsed.custom.chapters ?? [], lines: parsed.custom.lines ?? [] },
    disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [],
  }
}

export function Settings({ sync, settings, onSettings, data, onImport, onResetProgress }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLTextAreaElement>(null)
  const [exportText, setExportText] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [note, setNote] = useState<{ kind: 'info' | 'wrong'; text: string } | null>(null)

  function makeBackup() {
    setExportText(JSON.stringify({ version: 1, ...data }))
    setNote(null)
  }

  async function copyBackup() {
    if (!exportText) return
    try {
      await navigator.clipboard.writeText(exportText)
      setNote({ kind: 'info', text: '백업 텍스트를 복사했습니다. 메모장이나 메신저에 붙여 넣어 보관하세요.' })
    } catch {
      exportRef.current?.select()
      setNote({ kind: 'info', text: '자동 복사가 막혀 있어요. 선택된 텍스트를 직접 복사해 주세요.' })
    }
  }

  function restore(text: string) {
    try {
      onImport(parseBackup(text))
      setImportText('')
      setNote({ kind: 'info', text: '백업을 불러왔습니다.' })
    } catch {
      setNote({ kind: 'wrong', text: '백업 내용을 읽지 못했습니다. 복사한 텍스트 전체를 그대로 붙여 넣었는지 확인해 주세요.' })
    }
  }

  return (
    <section className="panel form">
      <h2>설정</h2>

      <label htmlFor="new-per-session">
        한 번에 배울 새 라인 수
        <select
          id="new-per-session"
          value={settings.newPerSession}
          onChange={(e) => onSettings({ ...settings, newPerSession: Number(e.target.value) })}
        >
          {[3, 5, 8, 10, 15].map((n) => (
            <option key={n} value={n}>
              {n}개
            </option>
          ))}
        </select>
      </label>

      <h3>저장</h3>
      <SyncNote sync={sync} />
      <p className="muted small">
        다른 기기로 옮기거나 브라우저 데이터를 지우기 전에는 백업 텍스트를 복사해 두면 안전합니다.
      </p>
      <div className="actions">
        <button className="btn" onClick={makeBackup}>
          백업 텍스트 만들기
        </button>
        {exportText && (
          <button className="btn primary" onClick={copyBackup}>
            복사
          </button>
        )}
      </div>
      {exportText && (
        <textarea id="backup-export" ref={exportRef} rows={4} readOnly value={exportText} onFocus={(e) => e.target.select()} />
      )}

      <label htmlFor="backup-import">
        백업 불러오기
        <textarea
          id="backup-import"
          rows={3}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="복사해 둔 백업 텍스트를 붙여 넣으세요"
        />
      </label>
      <div className="actions">
        <button className="btn" disabled={!importText.trim()} onClick={() => restore(importText)}>
          붙여 넣은 백업 불러오기
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          파일에서 불러오기
        </button>
        <input
          ref={fileRef}
          id="backup-file"
          type="file"
          accept="application/json,.json,.txt"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) restore(await f.text())
            e.target.value = ''
          }}
        />
      </div>
      {note && <p className={`message ${note.kind}`}>{note.text}</p>}

      <h3>초기화</h3>
      <p className="muted small">복습 기록만 지웁니다. 직접 추가한 라인은 남습니다.</p>
      <div className="actions">
        <ConfirmButton
          label="진도 초기화"
          confirmLabel="모든 복습 기록을 지울까요? 한 번 더 누르세요"
          onConfirm={() => {
            onResetProgress()
            setNote({ kind: 'info', text: '진도를 초기화했습니다.' })
          }}
        />
      </div>

      <h3>복습 간격</h3>
      <p className="muted small">
        라인을 실수 없이 끝내면 다음 복습까지 간격이 1일 → 3일 → 7일 → 14일 → 30일 → 60일 → 120일로 늘어납니다. 한 번이라도
        틀리면 다음 날 다시 나옵니다. 7일 간격까지 올라간 라인은 ‘익힘’으로 셉니다.
      </p>
    </section>
  )
}
