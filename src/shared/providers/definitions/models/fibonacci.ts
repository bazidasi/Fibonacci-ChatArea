import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { extractReasoningMiddleware, wrapLanguageModel } from 'ai'
import AbstractAISDKModel from '../../../models/abstract-ai-sdk'
import { fetchRemoteModels } from '../../../models/openai-compatible'
import type { CallChatCompletionOptions } from '../../../models/types'
import { createFetchWithProxy } from '../../../models/utils/fetch-proxy'
import type { ProviderModelInfo } from '../../../types'
import type { ModelDependencies } from '../../../types/adapters'
import { normalizeOpenAIApiHostAndPath } from '../../../utils/llm_utils'

interface Options {
  apiKey: string
  apiHost: string
  apiPath: string
  model: ProviderModelInfo
  temperature?: number
  topP?: number
  maxOutputTokens?: number
  stream?: boolean
  useProxy?: boolean
}

type FetchFunction = typeof globalThis.fetch

/**
 * Fibonacci AI — OpenAI-compatible provider (https://my.fibonacci.monster).
 *
 * Chat endpoint: POST {apiHost}{apiPath} (default
 * https://my.fibonacci.monster/api/v1/chat/completions) with
 * `Authorization: Bearer <token>`. Streaming uses standard OpenAI SSE chunks
 * (`data: {...}` lines, content in `choices[0].delta.content`, terminated by
 * `data: [DONE]`), which the AI SDK's OpenAI-compatible transport handles.
 *
 * Note: custom knowledge (RAG) is injected server-side into the system prompt
 * by the Fibonacci API — no client-side work is required.
 */
export default class FibonacciAI extends AbstractAISDKModel {
  public name = 'Fibonacci AI'

  constructor(
    public options: Options,
    dependencies: ModelDependencies
  ) {
    super(options, dependencies)
    const { apiHost, apiPath } = normalizeOpenAIApiHostAndPath(options)
    this.options = { ...options, apiHost, apiPath }
  }

  protected getCallSettings(options: CallChatCompletionOptions) {
    return {
      temperature: this.options.temperature,
      topP: this.options.topP,
      maxOutputTokens: this.options.maxOutputTokens,
      stream: this.options.stream,
    }
  }

  protected getProvider(_options: CallChatCompletionOptions, fetchFunction?: FetchFunction) {
    return createOpenAICompatible({
      name: this.name,
      apiKey: this.options.apiKey,
      baseURL: this.options.apiHost,
      fetch: fetchFunction,
    })
  }

  protected getChatModel(options: CallChatCompletionOptions) {
    const { apiHost, apiPath } = this.options
    const provider = this.getProvider(options, async (_input, init) => {
      return createFetchWithProxy(this.options.useProxy, this.dependencies)(`${apiHost}${apiPath}`, init)
    })
    return wrapLanguageModel({
      model: provider.languageModel(this.options.model.modelId),
      middleware: extractReasoningMiddleware({ tagName: 'think' }),
    })
  }

  public async listModels(): Promise<ProviderModelInfo[]> {
    try {
      const remote = await fetchRemoteModels(
        {
          apiHost: this.options.apiHost,
          apiKey: this.options.apiKey,
          useProxy: this.options.useProxy,
        },
        this.dependencies
      )
      if (remote.length > 0) return remote
    } catch {
      // fall through to the curated catalog below
    }
    return FIBONACCI_MODELS.map((m) => ({ ...m, type: 'chat' as const }))
  }

  protected getImageModel() {
    // Fibonacci AI does not expose image generation
    return null
  }
}

/** Curated Fibonacci AI catalog (always available offline). */
export const FIBONACCI_MODELS = [
  {
    modelId: 'fibonacci-1-pro-max',
    nickname: 'Fibonacci 1 Pro Max',
    contextWindow: 128_000,
    maxOutput: 8_000,
    capabilities: ['reasoning', 'tool_use'],
  },
  {
    modelId: 'fibonacci-1-agentic',
    nickname: 'Fibonacci 1 Agentic',
    contextWindow: 128_000,
    maxOutput: 8_000,
    capabilities: ['reasoning', 'tool_use'],
  },
  {
    modelId: 'fibonacci-2-sentiment',
    nickname: 'Fibonacci 2 Sentiment',
    contextWindow: 128_000,
    maxOutput: 8_000,
    capabilities: [],
  },
  {
    modelId: 'fibonacci-2-phoenix',
    nickname: 'Fibonacci 2 Phoenix',
    contextWindow: 128_000,
    maxOutput: 8_000,
    capabilities: ['tool_use'],
  },
  {
    modelId: 'fibonacci-2-coder',
    nickname: 'Fibonacci 2 Coder',
    contextWindow: 128_000,
    maxOutput: 8_000,
    capabilities: ['tool_use'],
  },
]
