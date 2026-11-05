import { Chess } from 'chess.js'

/** 한 수: SAN 표기와(있다면) 그 수에 달린 설명 */
export interface ParsedMove {
  san: string
  comment?: string
}

interface TreeNode {
  san: string
  comment?: string
  children: TreeNode[]
}

export class PgnError extends Error {}

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

function tokenize(text: string): string[] {
  // 헤더([Event "..."])와 ; 한 줄 주석 제거
  const cleaned = text
    .replace(/^\s*\[[^\]]*\]\s*$/gm, ' ')
    .replace(/;[^\n]*/g, ' ')
  const tokens: string[] = []
  const re = /\{[^}]*\}|\(|\)|[^\s(){}]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned))) tokens.push(m[0])
  return tokens
}

/** "12.", "12...", "12.e4" 같은 토큰에서 수 번호를 떼어 냅니다. */
function stripMoveNumber(token: string): string {
  return token.replace(/^\d+\.(\.\.)?/, '')
}

/**
 * PGN(변화 포함)을 파싱해서 처음부터 끝까지 이어지는 모든 라인을 돌려줍니다.
 * 변화 `( ... )`가 있으면 라인이 여러 개로 나뉩니다.
 */
export function parsePgnLines(text: string): ParsedMove[][] {
  const tokens = tokenize(text)
  const root: TreeNode = { san: '', children: [] }
  let i = 0

  function parseSeq(start: TreeNode) {
    let cur = start
    let prev: TreeNode | null = null
    while (i < tokens.length) {
      const tok = tokens[i++]
      if (tok === ')') return
      if (tok === '(') {
        if (!prev) throw new PgnError('변화 "(" 앞에 수가 없습니다.')
        parseSeq(prev)
        continue
      }
      if (tok.startsWith('{')) {
        const comment = tok.slice(1, -1).trim()
        if (comment && cur !== start) {
          cur.comment = cur.comment ? `${cur.comment} ${comment}` : comment
        }
        continue
      }
      if (tok.startsWith('$') || RESULT_TOKENS.has(tok)) continue
      const san = stripMoveNumber(tok).replace(/[!?]+$/, '')
      if (!san) continue
      const node: TreeNode = { san, children: [] }
      cur.children.push(node)
      prev = cur
      cur = node
    }
  }

  parseSeq(root)

  const lines: ParsedMove[][] = []
  function collect(node: TreeNode, path: ParsedMove[]) {
    if (node.children.length === 0) {
      if (path.length) lines.push(path)
      return
    }
    for (const child of node.children) {
      collect(child, [...path, { san: child.san, comment: child.comment }])
    }
  }
  collect(root, [])
  return lines
}

/** 수 목록을 실제로 두어 보며 합법인지 확인하고, 표준 SAN으로 바꿔 줍니다. */
export function normalizeMoves(moves: ParsedMove[]): ParsedMove[] {
  const chess = new Chess()
  return moves.map((m, idx) => {
    try {
      const played = chess.move(m.san)
      return { san: played.san, comment: m.comment }
    } catch {
      const moveNo = Math.floor(idx / 2) + 1
      const dots = idx % 2 === 0 ? '.' : '...'
      throw new PgnError(`${moveNo}${dots}${m.san} 은(는) 둘 수 없는 수입니다.`)
    }
  })
}

/** 포지션 비교용 키(수 번호 카운터는 제외) */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ')
}

/** 수 목록을 문자열로: 1.e4 e5 2.Nf3 */
export function movesToText(sans: string[]): string {
  return sans
    .map((san, idx) => (idx % 2 === 0 ? `${idx / 2 + 1}.${san}` : san))
    .join(' ')
}

/** 설명까지 포함한 PGN 문자열로 되돌립니다. */
export function movesToPgn(moves: ParsedMove[]): string {
  return moves
    .map((m, idx) => {
      const num = idx % 2 === 0 ? `${idx / 2 + 1}.` : ''
      const comment = m.comment ? ` {${m.comment.replace(/[{}]/g, '')}}` : ''
      return `${num}${m.san}${comment}`
    })
    .join(' ')
}
