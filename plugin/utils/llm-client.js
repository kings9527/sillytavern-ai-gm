/**
 * LLM Client for AI-GM
 *
 * Provides a unified interface to call LLM APIs for NPC dialogue generation,
 * intent parsing, and GM narration. Supports OpenAI-compatible APIs, SillyTavern
 * proxy mode, and local Ollama instances.
 *
 * @version 0.1.0
 */

/**
 * LLM client configuration
 * @typedef {Object} LLMConfig
 * @property {string} provider - 'openai', 'claude', 'ollama', or 'sillytavern'
 * @property {string} baseUrl - API base URL
 * @property {string} apiKey - API key (if required)
 * @property {string} model - Model name to use
 * @property {number} maxTokens - Max tokens per response (default 512)
 * @property {number} temperature - Temperature (default 0.7)
 * @property {number} timeout - Request timeout in ms (default 30000)
 * @property {number} retries - Retry count (default 2)
 */

const DEFAULT_CONFIG = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  maxTokens: 512,
  temperature: 0.7,
  timeout: 30000,
  retries: 2,
};

/**
 * Message format for chat completions
 * @typedef {Object} LLMMessage
 * @property {string} role - 'system', 'user', or 'assistant'
 * @property {string} content - Message content
 */

/**
 * LLM response format
 * @typedef {Object} LLMResponse
 * @property {string} content - Generated text
 * @property {number} promptTokens - Tokens used for prompt
 * @property {number} completionTokens - Tokens used for completion
 * @property {string} model - Model used
 * @property {boolean} cached - Whether this was a cached response
 */

export class LLMClient {
  /**
   * @param {LLMConfig} config - LLM configuration
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._cache = new Map();
    this._cacheMaxSize = 100;
    this._requestCount = 0;
    this._errorCount = 0;
  }

  /**
   * Update configuration dynamically
   * @param {Partial<LLMConfig>} newConfig
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if LLM is configured and available
   * @returns {boolean}
   */
  isAvailable() {
    if (this.config.provider === 'sillytavern') {
      // SillyTavern proxy doesn't need API key
      return true;
    }
    if (this.config.provider === 'ollama') {
      // Ollama typically doesn't need API key
      return !!this.config.baseUrl;
    }
    return !!this.config.apiKey && !!this.config.baseUrl;
  }

  /**
   * Send a chat completion request
   * @param {LLMMessage[]} messages - Array of messages
   * @param {Object} options - Additional options (override config)
   * @returns {Promise<LLMResponse>}
   * @throws {Error} If LLM is not available or request fails
   */
  async chat(messages, options = {}) {
    if (!this.isAvailable()) {
      throw new Error(
        'LLM not configured. Please set API key and base URL, or use SillyTavern proxy mode.',
      );
    }

    const mergedOptions = { ...this.config, ...options };

    // Check cache for non-streaming requests with same messages
    if (!mergedOptions.stream) {
      const cacheKey = this._cacheKey(messages, mergedOptions);
      const cached = this._cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    let lastError = null;
    const retries = mergedOptions.retries || this.config.retries;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this._sendRequest(messages, mergedOptions);
        this._requestCount++;

        // Cache successful responses
        if (!mergedOptions.stream) {
          this._cacheResponse(messages, mergedOptions, response);
        }

        return response;
      } catch (error) {
        lastError = error;
        this._errorCount++;

        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Exponential backoff before retry
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this._sleep(delay);
        }
      }
    }

    throw lastError || new Error('LLM request failed after all retries');
  }

  /**
   * Simple completion: send a single prompt and get text back
   * @param {string} prompt - User prompt
   * @param {string} [systemPrompt] - Optional system prompt
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated text content
   */
  async complete(prompt, systemPrompt = null, options = {}) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.chat(messages, options);
    return response.content;
  }

  /**
   * Generate JSON-structured output from LLM
   * Works across all providers (OpenAI, Claude, Ollama, SillyTavern)
   * by appending JSON formatting instructions rather than relying on
   * provider-specific response_format parameters.
   * @param {LLMMessage[]} messages - Messages
   * @param {Object} options - Options
   * @param {Object} [options.jsonSchema] - Optional JSON schema description
   * @returns {Promise<Object>} Parsed JSON object
   */
  async chatJSON(messages, options = {}) {
    const jsonInstruction = options.jsonSchema
      ? `\n\nYou must respond with a single JSON object that conforms to this schema:\n${JSON.stringify(options.jsonSchema, null, 2)}\nDo not include markdown code blocks, explanations, or any text outside the JSON object.`
      : '\n\nYou must respond with a single JSON object. Do not include markdown code blocks, explanations, or any text outside the JSON object.';

    // Append JSON instruction to the last user message, or add a new user message
    const modifiedMessages = messages.map((m, i) => {
      if (i === messages.length - 1 && m.role === 'user') {
        return { ...m, content: m.content + jsonInstruction };
      }
      return m;
    });

    // If last message was not user, append a new user message
    if (modifiedMessages[modifiedMessages.length - 1]?.role !== 'user') {
      modifiedMessages.push({ role: 'user', content: jsonInstruction });
    }

    const response = await this.chat(modifiedMessages, options);
    return this._extractJSON(response.content);
  }

  /**
   * Extract JSON object from raw text response
   * Handles markdown code blocks, trailing text, and malformed JSON
   * @private
   * @param {string} rawText
   * @returns {Object}
   */
  _extractJSON(rawText) {
    const text = rawText.trim();

    // 1. Try direct JSON parse
    try {
      return JSON.parse(text);
    } catch {
      // continue
    }

    // 2. Extract from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // continue
      }
    }

    // 3. Find the first '{' and last '}' that look like a JSON object
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      try {
        return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      } catch {
        // continue
      }
    }

    // 4. Find the first '[' and last ']' for JSON array
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(text.slice(arrStart, arrEnd + 1));
      } catch {
        // continue
      }
    }

    // 5. Fallback: return raw text wrapped in an error object
    console.warn('[LLMClient] Failed to parse JSON response, returning raw text');
    console.warn('[LLMClient] Raw response:', text.substring(0, 200));
    return { error: 'JSON parse failed', raw: text };
  }

  // ==================== Private Methods ====================

  /**
   * Send the actual HTTP request based on provider
   * @private
   */
  async _sendRequest(messages, options) {
    switch (options.provider) {
      case 'sillytavern':
        return this._sendSillyTavernRequest(messages, options);
      case 'ollama':
        return this._sendOllamaRequest(messages, options);
      case 'claude':
        return this._sendClaudeRequest(messages, options);
      case 'openai':
      default:
        return this._sendOpenAIRequest(messages, options);
    }
  }

  /**
   * OpenAI-compatible API request
   * @private
   */
  async _sendOpenAIRequest(messages, options) {
    const body = {
      model: options.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    };

    if (options.responseFormat) {
      body.response_format = options.responseFormat;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(`${options.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = new Error(`LLM API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || choice?.delta?.content || '';

      return {
        content: content.trim(),
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        model: data.model || options.model,
        cached: false,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('LLM request timeout');
      }
      throw error;
    }
  }

  /**
   * Claude API request (Anthropic)
   * @private
   */
  async _sendClaudeRequest(messages, options) {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const body = {
      model: options.model || 'claude-3-sonnet-20240229',
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature,
      system: systemMessages.map((m) => m.content).join('\n\n'),
      messages: userMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(`${options.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = new Error(`Claude API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      return {
        content: content.trim(),
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        model: data.model || options.model,
        cached: false,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Claude request timeout');
      }
      throw error;
    }
  }

  /**
   * Ollama local API request
   * @private
   */
  async _sendOllamaRequest(messages, options) {
    const body = {
      model: options.model || 'llama3',
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(`${options.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();

      return {
        content: (data.message?.content || '').trim(),
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        model: data.model || options.model,
        cached: false,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Ollama request timeout');
      }
      throw error;
    }
  }

  /**
   * SillyTavern proxy request
   * Uses SillyTavern's native OpenAI-compatible endpoint at /api/chat/completions
   * @private
   */
  async _sendSillyTavernRequest(messages, options) {
    // SillyTavern's native API endpoint is /api/chat/completions at the server base URL
    const baseUrl = options.baseUrl || 'http://localhost:5000';
    const endpoint = `${baseUrl}/api/chat/completions`;

    const body = {
      model: options.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = new Error(
          `SillyTavern proxy error: ${response.status} ${response.statusText}`,
        );
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      return {
        content: content.trim(),
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        model: data.model || options.model,
        cached: false,
      };
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('SillyTavern proxy request timeout');
      }
      throw error;
    }
  }

  /**
   * Generate cache key from messages and options
   * @private
   */
  _cacheKey(messages, options) {
    // Simple hash: provider + model + first 200 chars of messages
    const msgStr = messages
      .map((m) => `${m.role}:${m.content.substring(0, 100)}`)
      .join('|');
    return `${options.provider}:${options.model}:${msgStr}`;
  }

  /**
   * Cache a successful response
   * @private
   */
  _cacheResponse(messages, options, response) {
    const key = this._cacheKey(messages, options);
    this._cache.set(key, response);

    // LRU eviction
    if (this._cache.size > this._cacheMaxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get client statistics
   * @returns {Object} Stats
   */
  getStats() {
    return {
      requests: this._requestCount,
      errors: this._errorCount,
      cacheSize: this._cache.size,
      config: {
        provider: this.config.provider,
        model: this.config.model,
        available: this.isAvailable(),
      },
    };
  }

  /**
   * Clear response cache
   */
  clearCache() {
    this._cache.clear();
  }
}

/**
 * Create a default LLM client from environment variables
 * @returns {LLMClient}
 */
export function createLLMClientFromEnv() {
  return new LLMClient({
    provider: process.env.AI_GM_LLM_PROVIDER || 'openai',
    baseUrl: process.env.AI_GM_LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.AI_GM_LLM_API_KEY || '',
    model: process.env.AI_GM_LLM_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.AI_GM_LLM_MAX_TOKENS || '512', 10),
    temperature: parseFloat(process.env.AI_GM_LLM_TEMPERATURE || '0.7'),
    timeout: parseInt(process.env.AI_GM_LLM_TIMEOUT || '30000', 10),
  });
}

export default LLMClient;
