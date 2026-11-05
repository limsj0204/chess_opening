import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddLine } from './components/AddLine'
import { ChapterView } from './components/ChapterView'
import { Home } from './components/Home'
import { Settings } from './components/Settings'
import { Trainer, type QueueItem } from './components/Trainer'
import { Viewer } from './components/Viewer'
import { BUILTIN_CHAPTERS } from './data/repertoire'
import { buildChapters, buildCommentMap, EMPTY_CUSTOM, type CustomData } from './lib/repertoire'
import { connectCloud, mergeProgress, type CloudDoc } from './lib/cloud'
import { markLearned, schedule, type ProgressMap } from './lib/srs'
import { loadJson, saveJson, storageAvailable, useStored } from './lib/storage'
import type { Color } from './lib/types'

export type ColorFilter = 'all' | Color

/** 진도가 어디에 저장되는지 */
export type SyncStatus = 'checking' | 'cloud' | 'local' | 'none'

export interface AppSettings {
  newPerSession: number
  colorFilter: ColorFilter
}

const DEFAULT_SETTINGS: AppSettings = { newPerSession: 5, colorFilter: 'all' }

type Screen =
  | { name: 'home' }
  | { name: 'chapter'; id: string }
  | { name: 'train'; title: string; queue: QueueItem[]; back: Screen; key: number }
  | { name: 'view'; lineId: string; back: Screen }
  | { name: 'add'; chapterId?: string; back: Screen }
  | { name: 'settings' }

export default function App() {
  const [progress, setProgress] = useStored<ProgressMap>('progress', {})
  const [custom, setCustom] = useStored<CustomData>('custom', EMPTY_CUSTOM)
  const [disabled, setDisabled] = useStored<string[]>('disabled', [])
  const [settings, setSettings] = useStored<AppSettings>('settings', DEFAULT_SETTINGS)
  const [screen, setScreen] = useState<Screen>({ name: 'home' })
  const [sync, setSync] = useState<SyncStatus>('checking')
  const cloudRef = useRef<CloudDoc | null>(null)
  const lastSaved = useRef<string | null>(null)
  const mounted = useRef(false)

  // 설정·라인 변경 시각(기기 간에 어느 쪽이 최신인지 고를 때 씁니다)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    saveJson('updatedAt', Date.now())
  }, [custom, disabled, settings])

  // claude.ai에서 열렸다면 계정 저장 공간에 연결해 기록을 합칩니다.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cloud = await connectCloud()
      if (cancelled) return
      if (!cloud) {
        setSync(storageAvailable() ? 'local' : 'none')
        return
      }
      try {
        const remote = await cloud.load()
        if (cancelled) return
        if (remote) {
          lastSaved.current = JSON.stringify({
            progress: remote.progress,
            custom: remote.custom,
            disabled: remote.disabled,
            settings: remote.settings,
          })
          setProgress((local) => mergeProgress(local, remote.progress ?? {}))
          if ((remote.updatedAt ?? 0) > loadJson<number>('updatedAt', 0)) {
            if (remote.custom) setCustom(remote.custom)
            if (Array.isArray(remote.disabled)) setDisabled(remote.disabled)
            if (remote.settings) setSettings({ ...DEFAULT_SETTINGS, ...(remote.settings as AppSettings) })
          }
        }
        cloudRef.current = cloud
        setSync('cloud')
      } catch {
        setSync(storageAvailable() ? 'local' : 'none')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setProgress, setCustom, setDisabled, setSettings])

  // 바뀐 것이 있을 때만 계정에 저장합니다.
  useEffect(() => {
    const cloud = cloudRef.current
    if (sync !== 'cloud' || !cloud) return
    const body = JSON.stringify({ progress, custom, disabled, settings })
    if (body === lastSaved.current) return
    const t = setTimeout(() => {
      lastSaved.current = body
      cloud.save({ progress, custom, disabled, settings, updatedAt: Date.now() }).catch(() => {
        lastSaved.current = null
        setSync(storageAvailable() ? 'local' : 'none')
      })
    }, 700)
    return () => clearTimeout(t)
  }, [sync, progress, custom, disabled, settings])

  const chapters = useMemo(() => buildChapters(BUILTIN_CHAPTERS, custom), [custom])
  const disabledSet = useMemo(() => new Set(disabled), [disabled])
  const allLines = useMemo(() => chapters.flatMap((c) => c.lines), [chapters])
  const activeLines = useMemo(() => allLines.filter((l) => !disabledSet.has(l.id)), [allLines, disabledSet])
  const lineMap = useMemo(() => new Map(allLines.map((l) => [l.id, l])), [allLines])
  const comments = useMemo(() => buildCommentMap(allLines), [allLines])

  const record = useCallback(
    (lineId: string, success: boolean) =>
      setProgress((p) => ({ ...p, [lineId]: schedule(p[lineId], success, Date.now()) })),
    [setProgress],
  )

  const learned = useCallback(
    (lineId: string) => setProgress((p) => ({ ...p, [lineId]: markLearned(p[lineId], Date.now()) })),
    [setProgress],
  )

  const startTraining = (title: string, queue: QueueItem[]) => {
    if (queue.length === 0) return
    setScreen((back) => ({ name: 'train', title, queue, back, key: Date.now() }))
  }

  const toggleLine = (id: string) =>
    setDisabled((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))

  const deleteLine = (id: string) => {
    setCustom((c) => ({ ...c, lines: c.lines.filter((l) => l.id !== id) }))
    setProgress(({ [id]: _removed, ...rest }) => rest)
  }

  const deleteChapter = (id: string) => {
    const ids = new Set(custom.lines.filter((l) => l.chapterId === id).map((l) => l.id))
    setCustom((c) => ({ chapters: c.chapters.filter((x) => x.id !== id), lines: c.lines.filter((l) => l.chapterId !== id) }))
    setProgress((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !ids.has(k))))
    setScreen({ name: 'home' })
  }

  let body
  switch (screen.name) {
    case 'home':
      body = (
        <Home
          chapters={chapters}
          activeLines={activeLines}
          progress={progress}
          settings={settings}
          sync={sync}
          onSettings={setSettings}
          onTrain={startTraining}
          onOpenChapter={(id) => setScreen({ name: 'chapter', id })}
        />
      )
      break
    case 'chapter': {
      const chapter = chapters.find((c) => c.id === screen.id)
      if (!chapter) {
        body = null
        break
      }
      body = (
        <ChapterView
          chapter={chapter}
          progress={progress}
          disabled={disabledSet}
          onBack={() => setScreen({ name: 'home' })}
          onTrain={startTraining}
          onView={(lineId) => setScreen({ name: 'view', lineId, back: screen })}
          onToggle={toggleLine}
          onDeleteLine={deleteLine}
          onDeleteChapter={() => deleteChapter(chapter.id)}
          onAdd={() => setScreen({ name: 'add', chapterId: chapter.id, back: screen })}
        />
      )
      break
    }
    case 'train':
      body = (
        <Trainer
          key={screen.key}
          title={screen.title}
          initialQueue={screen.queue}
          lines={lineMap}
          comments={comments}
          onRecord={record}
          onLearned={learned}
          onExit={() => setScreen(screen.back)}
        />
      )
      break
    case 'view': {
      const line = lineMap.get(screen.lineId)
      body = line ? (
        <Viewer
          line={line}
          comments={comments}
          onBack={() => setScreen(screen.back)}
          onPractice={() => startTraining(line.name, [{ lineId: line.id, mode: 'practice' }])}
        />
      ) : null
      break
    }
    case 'add':
      body = (
        <AddLine
          chapters={chapters}
          activeLines={activeLines}
          defaultChapterId={screen.chapterId}
          onCancel={() => setScreen(screen.back)}
          onSave={(chapter, lines) => {
            setCustom((c) => ({
              chapters: chapter ? [...c.chapters, chapter] : c.chapters,
              lines: [...c.lines, ...lines],
            }))
            setScreen({ name: 'chapter', id: chapter?.id ?? lines[0].chapterId })
          }}
        />
      )
      break
    case 'settings':
      body = (
        <Settings
          sync={sync}
          settings={settings}
          onSettings={setSettings}
          data={{ progress, custom, disabled }}
          onImport={(d) => {
            setProgress(d.progress)
            setCustom(d.custom)
            setDisabled(d.disabled)
          }}
          onResetProgress={() => setProgress({})}
        />
      )
      break
  }

  const nav = (s: Screen, label: string) => (
    <button className={`nav-btn ${screen.name === s.name ? 'active' : ''}`} onClick={() => setScreen(s)}>
      {label}
    </button>
  )

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setScreen({ name: 'home' })}>
          ♞ 오프닝 트레이너
        </button>
        <nav>
          {nav({ name: 'home' }, '홈')}
          {nav({ name: 'add', back: screen }, '라인 추가')}
          {nav({ name: 'settings' }, '설정')}
        </nav>
      </header>
      <main>{body}</main>
    </div>
  )
}
