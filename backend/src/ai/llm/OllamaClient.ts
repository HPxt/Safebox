/**
 * LLMClient - Cliente para LLM Local (LM Studio)
 * 
 * Integração com LM Studio (API OpenAI-compatible) para execução de LLMs localmente
 * - Zero custo por requisição
 * - Privacidade total (dados não saem do servidor)
 * - Modelo: GPT OSS 20B (20 bilhões de parâmetros)
 * - API compatível OpenAI
 */

import { AxiosInstance } from 'axios';
import { LLMRequest, LLMResponse } from '../types';
import { logger } from '../../utils/logger';
import { createSecureHttpClient } from '../../security/outboundHttp';

export interface LLMConfig {
  host: string; // Default: http://localhost:1234
  model: string; // Default: gpt-oss-20b
  timeout: number; // em ms
  maxRetries: number;
}

export class LLMClient {
  private client: AxiosInstance;
  private config: LLMConfig;
  private static getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown LLM client error';
  }

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      host: config?.host || process.env['LMSTUDIO_HOST'] || 'http://localhost:1234',
      model: config?.model || process.env['LMSTUDIO_MODEL'] || 'gpt-oss-20b',
      timeout: config?.timeout || parseInt(process.env['LLM_TIMEOUT'] || '120000'), // 2 minutos
      maxRetries: config?.maxRetries || parseInt(process.env['LLM_MAX_RETRIES'] || '3')
    };

    this.client = createSecureHttpClient({
      baseURL: `${this.config.host}/v1`,
      timeoutMs: this.config.timeout,
      maxRetries: this.config.maxRetries,
      allowHosts: ['localhost', '127.0.0.1', '::1'],
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info('LLMClient initialized (LM Studio)', {
      model: this.config.model
    });
  }

  /**
   * Gera resposta do LLM (API OpenAI-compatible)
   */
  async generate(request: Partial<LLMRequest>): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const payload = {
        model: request.model || this.config.model,
        messages: [
          ...(request.systemPrompt ? [{
            role: 'system' as const,
            content: request.systemPrompt
          }] : []),
          {
            role: 'user' as const,
            content: request.prompt || ''
          }
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 512,
        stream: request.stream ?? false
      };

      logger.debug('LLM generate request', {
        model: payload.model,
        promptLength: request.prompt?.length || 0,
        hasSystemPrompt: !!request.systemPrompt
      });

      const response = await this.client.post('/chat/completions', payload);

      const processingTime = Date.now() - startTime;

      const result: LLMResponse = {
        response: response.data.choices[0].message.content,
        tokensUsed: {
          prompt: response.data.usage?.prompt_tokens || 0,
          completion: response.data.usage?.completion_tokens || 0,
          total: response.data.usage?.total_tokens || 0
        },
        processingTime,
        model: payload.model
      };

      logger.info('LLM generate success', {
        model: payload.model,
        processingTime,
        tokensUsed: result.tokensUsed.total,
        responseLength: result.response.length
      });

      return result;

    } catch (error: any) {
      logger.error('LLM generate error', {
        message: LLMClient.getErrorMessage(error),
        model: this.config.model
      });

      throw new Error(`LLM generation failed: ${LLMClient.getErrorMessage(error)}`);
    }
  }

  /**
   * Chat completion (multi-turn conversation)
   */
  async chat(messages: Array<{ role: 'system' | 'user' | 'assistant', content: string }>): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const payload = {
        model: this.config.model,
        messages,
        temperature: 0.7,
        stream: false
      };

      logger.debug('LLM chat request', {
        model: payload.model,
        messageCount: messages.length
      });

      const response = await this.client.post('/chat/completions', payload);

      const processingTime = Date.now() - startTime;

      const result: LLMResponse = {
        response: response.data.choices[0].message.content,
        tokensUsed: {
          prompt: response.data.usage?.prompt_tokens || 0,
          completion: response.data.usage?.completion_tokens || 0,
          total: response.data.usage?.total_tokens || 0
        },
        processingTime,
        model: payload.model
      };

      logger.info('LLM chat success', {
        model: payload.model,
        processingTime,
        tokensUsed: result.tokensUsed.total
      });

      return result;

    } catch (error: any) {
      logger.error('LLM chat error', {
        message: LLMClient.getErrorMessage(error),
        model: this.config.model
      });

      throw new Error(`LLM chat failed: ${LLMClient.getErrorMessage(error)}`);
    }
  }

  /**
   * Verifica se o LM Studio está disponível
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/models');
      logger.info('LM Studio health check success', {
        modelsAvailable: response.data.data?.length || 0
      });
      return true;
    } catch (error: any) {
      logger.error('LM Studio health check failed', {
        message: LLMClient.getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Lista modelos disponíveis
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/models');
      const models = response.data.data?.map((m: any) => m.id) || [];
      
      logger.info('LM Studio models listed', { count: models.length });
      
      return models;
    } catch (error: any) {
      logger.error('Failed to list LM Studio models', {
        message: LLMClient.getErrorMessage(error)
      });
      return [];
    }
  }

  /**
   * Verifica se um modelo específico está disponível
   */
  async isModelAvailable(modelName?: string): Promise<boolean> {
    const model = modelName || this.config.model;
    const models = await this.listModels();
    return models.some(m => m.includes(model));
  }

  /**
   * Retry logic para requisições
   */
  private async retryGenerate(request: Partial<LLMRequest>, attempt: number = 1): Promise<LLMResponse> {
    try {
      return await this.generate(request);
    } catch (error: any) {
      if (attempt >= this.config.maxRetries) {
        throw error;
      }

      logger.warn('LLM request failed, retrying', {
        attempt,
        maxRetries: this.config.maxRetries,
        message: LLMClient.getErrorMessage(error)
      });

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.retryGenerate(request, attempt + 1);
    }
  }

  /**
   * Gera resposta com retry automático
   */
  async generateWithRetry(request: Partial<LLMRequest>): Promise<LLMResponse> {
    return this.retryGenerate(request);
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<LLMConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('LLMClient config updated', {
      model: this.config.model,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
  }
}

// Singleton instance
let instance: LLMClient | null = null;

export function getLLMClient(config?: Partial<LLMConfig>): LLMClient {
  if (!instance) {
    instance = new LLMClient(config);
  }
  return instance;
}

export function resetLLMClient(): void {
  instance = null;
}

// Exportar também com nomes compatíveis
export const getOllamaClient = getLLMClient;
export const resetOllamaClient = resetLLMClient;
export type OllamaClient = LLMClient;
export type OllamaConfig = LLMConfig;

