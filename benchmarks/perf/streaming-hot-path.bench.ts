/**
 * Micro-benchmarks for the renderer's streaming hot path.
 *
 * Every number below is measured against the real production functions (not
 * copies), at session sizes representative of long chats. Run with:
 *
 *   npx vitest run --config vitest.perf.config.ts
 */
import { applyMessageUpdate } from '@chatbox/core/application/session'
import type { Message, Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import rehypeKatex from 'rehype-katex'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { describe, test } from 'vitest'
import { buildMessageRenderItems } from '@/components/chat/message-render-items'
import {
  canReuseMinimapAnchorsDuringGeneration,
  getMessagePreviewText,
} from '@/components/chat/message-navigation-utils'
import { highlightSync, preloadLanguage } from '@/packages/shiki'
import { mergeCachedGeneratingMessages } from '../../packages/chatbox-react/src/query/session-cache-policy'

// ---------------------------------------------------------------------------
// timing helpers
// ---------------------------------------------------------------------------

type Result = { label: string; iterations: number; totalMs: number; perOpMs: number }

function time(label: string, iterations: number, fn: (i: number) => void): Result {
  const warmup = Math.min(iterations, 20)
  for (let i = 0; i < warmup; i++) fn(i)
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn(i)
  const totalMs = performance.now() - start
  return { label, iterations, totalMs, perOpMs: totalMs / iterations }
}

function report(results: Result[], note?: string) {
  const width = Math.max(...results.map((r) => r.label.length))
  console.log(`\n=== ${note ?? 'results'} ===`)
  for (const r of results) {
    console.log(
      `${r.label.padEnd(width)} | ${r.perOpMs.toFixed(4).padStart(9)} ms/op | ${r.totalMs.toFixed(1).padStart(8)} ms / ${r.iterations} ops`
    )
  }
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const PARAGRAPH = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. '

function makeMessage(id: string, role: Message['role'], text: string): Message {
  return {
    id,
    role,
    contentParts: [{ type: 'text', text }],
  } as unknown as Message
}

/** Builds a session shaped like a long real chat: N alternating turns, ~1.4 KB each. */
function makeSession(messageCount: number, id = 'session-perf'): Session {
  const messages: Message[] = []
  for (let i = 0; i < messageCount; i++) {
    const role: Message['role'] = i % 2 === 0 ? 'user' : 'assistant'
    messages.push(makeMessage(`m${i}`, role, `Message ${i}: ${PARAGRAPH.repeat(16)}`))
  }
  return { id, type: 'chat', messages, settings: {} } as unknown as Session
}

/** Faithful copy of `getAllMessageList` (sessionHelpers.ts) — that module needs a full platform mock to import. */
function getAllMessageList(s: Session): Message[] {
  let messageContext: Message[] = []
  if (s.threads) {
    for (const thread of s.threads) messageContext = messageContext.concat(thread.messages)
  }
  if (s.messages) messageContext = messageContext.concat(s.messages)
  return messageContext
}

/** Builds streaming markdown that grows the way a real reply does. */
function markdownOfLength(target: number): string {
  let out = '# Answer\n\n'
  let i = 0
  while (out.length < target) {
    const block = i % 4
    if (block === 0) {
      out += `## Section ${i}\n\nSome **bold** text with \`inline code\` and a [link](https://example.com/${i}).\n\n`
    } else if (block === 1) {
      out += `- item ${i}.1 with $x^2 + y^2 = z^2$ math\n- item ${i}.2\n- item ${i}.3\n\n`
    } else if (block === 2) {
      out += `| col A | col B |\n| --- | --- |\n| ${i} | value ${i} |\n\n`
    } else {
      out += `\`\`\`ts\nconst value${i} = compute(${i})\nexport default value${i}\n\`\`\`\n\n`
    }
    i++
  }
  return out.slice(0, target)
}

// ---------------------------------------------------------------------------
// 1. session-store hot path (runs once per streamed chunk)
// ---------------------------------------------------------------------------

describe('streaming hot path', () => {
  test('per-chunk session work', () => {
    const MESSAGE_COUNT = 400
    const CHUNKS_PER_GENERATION = 1800 // ~30 chunks/s for a 60 s reply

    const session = makeSession(MESSAGE_COUNT)
    const list = getAllMessageList(session)
    const streamingId = list[list.length - 1].id

    const results: Result[] = []

    // (a) cache-only write: applyMessageUpdate + whole-session clone (per chunk)
    results.push(
      time('applyMessageUpdate (400 msgs)', 2000, (i) => {
        const next = makeMessage(streamingId, 'assistant', `${PARAGRAPH}${i}`)
        applyMessageUpdate(session, session.id, streamingId, next)
      })
    )

    // (b) list flattening done by MessageList on every session identity change
    results.push(time('getAllMessageList (400 msgs)', 2000, () => getAllMessageList(session)))

    // (c) render-item rebuild (MessageList useMemo, per chunk)
    results.push(time('buildMessageRenderItems', 2000, () => buildMessageRenderItems(list)))

    // (d) first-token bookkeeping: full text join of the streaming message
    const growing = makeMessage(streamingId, 'assistant', PARAGRAPH.repeat(200)) // ~10 KB
    results.push(time('getMessageText(streaming msg)', 2000, () => getMessageText(growing, true, true).length))

    // (e) minimap freeze check (per chunk on desktop)
    const previous = list.slice()
    const current = list.slice()
    current[current.length - 1] = makeMessage(streamingId, 'assistant', 'x')
    results.push(
      time('canReuseMinimapAnchorsDuringGeneration', 2000, () =>
        canReuseMinimapAnchorsDuringGeneration(previous, current)
      )
    )

    // (f) minimap anchor text build (per non-streaming session identity change)
    results.push(
      time('getMessagePreviewText x200 users', 500, () => {
        for (const message of list) if (message.role === 'user') getMessagePreviewText(message)
      })
    )

    // (g) full-session write: every 2 s checkpoint + every tool-call chunk
    results.push(time('JSON.stringify(session) 400 msgs', 200, () => JSON.stringify(session)))

    // (h) persisted-write projection (mergeCachedGeneratingMessages)
    results.push(time('mergeCachedGeneratingMessages', 2000, () => mergeCachedGeneratingMessages(session, session)))

    report(results, '1. per-chunk session work (400-message session)')

    const perChunkMs = results
      .filter((r) =>
        [
          'applyMessageUpdate (400 msgs)',
          'buildMessageRenderItems',
          'getMessageText(streaming msg)',
        ].includes(r.label)
      )
      .reduce((sum, r) => sum + r.perOpMs, 0)
    console.log(
      `\ncombined store+derive work per chunk: ${perChunkMs.toFixed(4)} ms\n` +
        `extrapolated over ${CHUNKS_PER_GENERATION} chunks (60 s reply): ${(perChunkMs * CHUNKS_PER_GENERATION).toFixed(1)} ms ` +
        'of main-thread time before React render + markdown parse'
    )
  })
})

// ---------------------------------------------------------------------------
// 2. markdown pipeline (react-markdown re-parses the whole accumulated text
//    on every chunk; this mirrors its remark + rehype chain)
// ---------------------------------------------------------------------------

function createMarkdownProcessor() {
  return unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkBreaks).use(remarkRehype).use(rehypeKatex)
}

function runMarkdown(processor: ReturnType<typeof createMarkdownProcessor>, text: string) {
  const mdast = processor.parse(text)
  return processor.runSync(mdast)
}

describe('markdown pipeline', () => {
  test('full re-parse per chunk', () => {
    const processor = createMarkdownProcessor()
    const sizes = [2_000, 8_000, 16_000, 32_000]
    const results: Result[] = sizes.map((size) => {
      const text = markdownOfLength(size)
      const iterations = size <= 8_000 ? 60 : 25
      return time(`parse+rehype ${size / 1000} KB md`, iterations, () => runMarkdown(processor, text))
    })
    report(results, '2a. markdown parse cost vs. accumulated reply size')

    // Linearity check, then the cumulative cost of naive per-chunk re-parsing.
    const byLabel = new Map(results.map((r) => [r.label, r.perOpMs]))
    const at8k = byLabel.get('parse+rehype 8 KB md') ?? 0
    const at16k = byLabel.get('parse+rehype 16 KB md') ?? 0
    const at2k = byLabel.get('parse+rehype 2 KB md') ?? 0
    const CHUNKS = 1800
    console.log(
      `\nscaling 2 KB -> 16 KB: ${(at16k / at2k).toFixed(2)}x for 8x the text (${at2k.toFixed(3)} ms -> ${at16k.toFixed(3)} ms)\n` +
        `naive per-chunk re-parse, 16 KB final reply / ${CHUNKS} chunks (avg 8 KB): ~${(at8k * CHUNKS).toFixed(0)} ms total\n` +
        `tail-only re-parse (2 KB unstable block): ~${(at2k * CHUNKS).toFixed(0)} ms total ` +
        `-> saves ~${((at8k - at2k) * CHUNKS).toFixed(0)} ms per 60 s reply`
    )
  })

  test('streaming segment HAST wrap', async () => {
    const processor = createMarkdownProcessor()
    const { wrapStreamingSegmentsInHast } = await import('@/components/streaming-text-fade')
    const text = markdownOfLength(16_000)
    const segments = [
      { createdAt: 0, endOffset: 15_980, key: '0-15980', startOffset: 0 },
      { createdAt: 0, endOffset: 16_000, key: '15980-16000', startOffset: 15_980 },
    ]
    const iterations = 30
    const withWrap = time('runMarkdown + wrapStreamingSegmentsInHast', iterations, () => {
      const tree = runMarkdown(processor, text) as unknown as Parameters<typeof wrapStreamingSegmentsInHast>[0]
      wrapStreamingSegmentsInHast(tree, segments)
    })
    const parseOnly = time('runMarkdown only (same text)', iterations, () => runMarkdown(processor, text))
    report([withWrap, parseOnly], '2b. streaming fade HAST rewrite')
    console.log(
      `\nwrapStreamingSegmentsInHast alone (derived): ${(withWrap.perOpMs - parseOnly.perOpMs).toFixed(3)} ms per chunk at 16 KB`
    )
  })
})

// ---------------------------------------------------------------------------
// 2c. token/word counting on the persist checkpoint (refreshCounting: true,
//     every STREAM_PERSIST_INTERVAL_MS and on every final write)
// ---------------------------------------------------------------------------

describe('checkpoint counting', () => {
  test('countMessageWords + estimateTokensFromMessages', async () => {
    const { countMessageWords } = await import('@shared/utils/message')
    const { estimateTokensFromMessages } = await import('@/packages/token')

    const results: Result[] = []
    for (const size of [4_000, 16_000, 64_000]) {
      const message = makeMessage('stream', 'assistant', PARAGRAPH.repeat(Math.ceil(size / PARAGRAPH.length)))
      results.push(time(`countMessageWords ${size / 1000} KB`, 300, () => countMessageWords(message)))
      results.push(time(`estimateTokensFromMessages ${size / 1000} KB`, 300, () => estimateTokensFromMessages([message])))
    }
    report(results, '2c. per-checkpoint counting (main thread)')
  })
})

// ---------------------------------------------------------------------------
// 3. shiki syntax highlighting (final render of a code block)
// ---------------------------------------------------------------------------

describe('shiki highlight', () => {
  test('synchronous highlight of a completed code block', async () => {
    await preloadLanguage('typescript')
    const lines: string[] = []
    for (let i = 0; i < 200; i++) {
      lines.push(`export function handler${i}(input: string): number { return input.length + ${i} }`)
    }
    const code = lines.join('\n') // ~11 KB, 200 lines
    // Cache is keyed on the code, so each iteration must use distinct text.
    const result = time('highlightSync 11 KB / 200 lines', 60, (i) =>
      highlightSync(`${code}\n// rev ${i}`, 'typescript', 'one-dark-pro')
    )
    report([result], '3. shiki highlightSync (main thread)')

    const smallCode = lines.slice(0, 40).join('\n')
    const small = time('highlightSync 2 KB / 40 lines', 60, (i) =>
      highlightSync(`${smallCode}\n// rev ${i}`, 'typescript', 'one-dark-pro')
    )
    report([small], '3b. small code block for comparison')
  })
})
