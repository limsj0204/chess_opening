import { useRef, useState } from 'react'
import type { AppSettings } from '../App'
import type { CustomData } from '../lib/repertoire'
import type { ProgressMap } from '../lib/srs'

export interface BackupData {
  progress: ProgressMap
  custom: CustomData
  disabled: string[]
}

interface Props {
  settings: AppSettings
  onSettings: (s: AppSettings) => void
  data: BackupData
  onImport: (d: BackupData) => void
  onResetProgress: () => void
}

export function Settings({ settings, onSettings, data, onImport, onResetProgress }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState<string | null>(null)

  function exportData() {
    const blob = new Blob([JSON.stringify({ version: 1, ...data }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `opening-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importData(file: File) {
    try {
      const parsed = JSON.parse(await file.text())
      if (typeof parsed !== 'object' || !parsed.progress || !parsed.custom) throw new Error()
      onImport({
        progress: parsed.progress,
        custom: { chapters: parsed.custom.chapters ?? [], lines: parsed.custom.lines ?? [] },
        disabled: Array.isArray(parsed.disabled) ? parsed.disabled : [],
      })
      setNote('백업을 불러왔습니다.')
    } catch {
      setNote('백업 파일을 읽지 못했습니다.')
    }
  }

  return (
    <section className="panel form">
      <h2>설정</h2>

      <label>
        한 번에 배울 새 라인 수
        <select
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

      <h3>백업</h3>
      <p className="muted small">
        진도와 직접 추가한 라인은 이 브라우저에만 저장됩니다. 다른 기기로 옮기거나 브라우저 데이터를 지우기 전에 백업해
        두세요.
      </p>
      <div className="actions">
        <button className="btn" onClick={exportData}>
          백업 파일 저장
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          백업 불러오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importData(f)
            e.target.value = ''
          }}
        />
      </div>
      {note && <p className="message info">{note}</p>}

      <h3>초기화</h3>
      <div className="actions">
        <button
          className="btn danger"
          onClick={() => confirm('모든 복습 기록을 지울까요? (직접 추가한 라인은 남습니다)') && onResetProgress()}
        >
          진도 초기화
        </button>
      </div>

      <h3>복습 간격</h3>
      <p className="muted small">
        라인을 실수 없이 끝내면 다음 복습까지 간격이 1일 → 3일 → 7일 → 14일 → 30일 → 60일 → 120일로 늘어납니다. 한 번이라도
        틀리면 다음 날 다시 나옵니다. 7일 간격까지 올라간 라인은 ‘익힘’으로 셉니다.
      </p>
    </section>
  )
}
