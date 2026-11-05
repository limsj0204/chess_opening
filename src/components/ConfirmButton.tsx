import { useEffect, useState } from 'react'

interface Props {
  label: string
  confirmLabel: string
  onConfirm: () => void
  small?: boolean
}

/** 한 번 누르면 확인 문구로 바뀌고, 한 번 더 누르면 실행되는 버튼 */
export function ConfirmButton({ label, confirmLabel, onConfirm, small }: Props) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      className={`btn danger ${small ? 'small-btn' : ''} ${armed ? 'armed' : ''}`}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}
