/**
 * ContextAwareAgent - Classe Base para Todos os Agentes de IA
 * 
 * PRINCÍPIO FUNDAMENTAL: Context Awareness
 * - Agentes DEVEM carregar contexto antes de executar
 * - Agentes DEVEM validar contra princípios de segurança
 * - Agentes DEVEM auditar todas as ações
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentType,
  AgentStatus,
  AgentContext,
  AgentConfig,
  AgentResult,
  LoadedContext,
  Finding,
  Action,
  AIAuditLog
} from '../../types';
import { ContextManager } from '../../context/ContextManager';
import { DataSanitizer } from '../../sanitizer/DataSanitizer';
import { getLLMClient, LLMClient } from '../../llm/OllamaClient';
import { PromptTemplates } from '../../llm/PromptTemplates';
import { logger } from '../../../utils/logger';

export abstract class ContextAwareAgent {
  protected agentType: AgentType;
  protected config: AgentConfig;
  protected context: LoadedContext | null = null;
  protected contextManager: ContextManager;
  protected llmClient: LLMClient;
  protected status: AgentStatus = AgentStatus.IDLE;
  protected static getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown AI agent error';
  }

  constructor(agentType: AgentType, config?: Partial<AgentConfig>) {
    this.agentType = agentType;
    this.config = {
      enabled: config?.enabled ?? true,
      automationLevel: config?.automationLevel ?? 2,
      schedule: config?.schedule ?? '0 2 * * 0', // Domingo 02:00
      maxRetries: config?.maxRetries ?? 3,
      timeout: config?.timeout ?? 300 // 5 minutos
    };

    this.contextManager = new ContextManager();
    this.llmClient = getLLMClient();

    logger.info(`${this.agentType} agent initialized`, {
      automationLevel: this.config.automationLevel,
      scheduleConfigured: Boolean(this.config.schedule)
    });
  }

  /**
   * Executa o agente (método público principal)
   */
  async execute(): Promise<AgentResult> {
    const executionId = uuidv4();
    const startTime = Date.now();

    this.status = AgentStatus.RUNNING;

    logger.info(`${this.agentType} agent execution started`, { executionId });

    try {
      // 1. Carregar contexto obrigatório
      await this.loadContext();

      // 2. Validar contexto
      this.validateContext();

      // 3. Coletar dados
      const rawData = await this.collectData();

      // 4. Sanitizar dados
      const sanitizedData = this.sanitizeData(rawData);

      // 5. Validar segurança dos dados
      this.validateDataSafety(sanitizedData);

      // 6. Analisar com LLM
      const analysisResult = await this.analyze(sanitizedData);

      // 7. Criar findings e ações
      const findings = this.createFindings(analysisResult);
      const actions = this.createActions(findings);

      // 8. Executar ações (conforme nível de automação)
      const executedActions = await this.executeActions(actions);

      // 9. Auditar execução
      await this.auditExecution(executionId, findings, executedActions);

      const executionTime = Date.now() - startTime;

      this.status = AgentStatus.COMPLETED;

      const result: AgentResult = {
        success: true,
        executionTime,
        findings,
        actions: executedActions,
        metadata: {
          dataProcessed: Array.isArray(sanitizedData) ? sanitizedData.length : 1,
          anomaliesDetected: findings.length,
          actionsExecuted: executedActions.filter(a => a.executed).length
        }
      };

      logger.info(`${this.agentType} agent execution completed`, {
        executionId,
        executionTime,
        findingsCount: findings.length,
        actionsCount: executedActions.length
      });

      return result;

    } catch (error: any) {
      this.status = AgentStatus.ERROR;

      logger.error(`${this.agentType} agent execution failed`, {
        executionId,
        message: ContextAwareAgent.getErrorMessage(error)
      });

      return {
        success: false,
        executionTime: Date.now() - startTime,
        findings: [],
        actions: [],
        errors: [ContextAwareAgent.getErrorMessage(error)],
        metadata: {
          dataProcessed: 0,
          anomaliesDetected: 0,
          actionsExecuted: 0
        }
      };
    }
  }

  /**
   * Carrega contexto obrigatório
   */
  protected async loadContext(): Promise<void> {
    logger.debug(`${this.agentType} loading context...`);

    this.context = await this.contextManager.loadContext(this.agentType);

    if (!this.context.isValid) {
      throw new Error(`Context validation failed for ${this.agentType}`);
    }

    logger.info(`${this.agentType} context loaded`, {
      documentsCount: this.context.documents.length,
      principlesCount: this.context.principles.length
    });
  }

  /**
   * Valida contexto carregado
   */
  protected validateContext(): void {
    if (!this.context) {
      throw new Error('Context not loaded. Call loadContext() first.');
    }

    if (!this.context.isValid) {
      throw new Error('Context is invalid.');
    }

    // Validar princípios mandatórios
    const mandatoryPrinciples = this.context.principles.filter(p => p.mandatory);
    
    logger.debug(`${this.agentType} validating mandatory principles`, {
      count: mandatoryPrinciples.length
    });

    // Todos os princípios mandatórios devem estar presentes
    if (mandatoryPrinciples.length === 0) {
      logger.warn(`${this.agentType} no mandatory principles found in context`);
    }
  }

  /**
   * Valida segurança dos dados antes de processar
   */
  protected validateDataSafety(data: any): void {
    const { safe, violations } = DataSanitizer.isSafeForAI(data);

    if (!safe) {
      logger.error(`${this.agentType} data safety validation failed`, {
        violations
      });

      throw new Error(
        `SECURITY VIOLATION: Unsafe data detected. Violations: ${violations.join(', ')}`
      );
    }

    logger.debug(`${this.agentType} data safety validated`);
  }

  /**
   * Executa ações conforme nível de automação
   */
  protected async executeActions(actions: Action[]): Promise<Action[]> {
    const executedActions: Action[] = [];

    for (const action of actions) {
      // Nível 1: Apenas alertas (nenhuma ação automática)
      if (this.config.automationLevel === 1) {
        action.executed = false;
        executedActions.push(action);
        continue;
      }

      // Nível 2: Sugestões (executar apenas se pré-aprovado)
      if (this.config.automationLevel === 2) {
        if (action.approved) {
          const result = await this.performAction(action);
          action.executed = true;
          action.executedAt = new Date();
          action.result = result;
        } else {
          action.executed = false;
        }
        executedActions.push(action);
        continue;
      }

      // Nível 3: Automação parcial (ações não-críticas automáticas)
      if (this.config.automationLevel === 3) {
        if (!action.requiresApproval) {
          const result = await this.performAction(action);
          action.executed = true;
          action.executedAt = new Date();
          action.result = result;
        } else {
          action.executed = false;
        }
        executedActions.push(action);
        continue;
      }

      // Nível 4: Totalmente autônomo (todas as ações executadas)
      if (this.config.automationLevel === 4) {
        const result = await this.performAction(action);
        action.executed = true;
        action.executedAt = new Date();
        action.result = result;
        executedActions.push(action);
      }
    }

    logger.info(`${this.agentType} actions executed`, {
      total: actions.length,
      executed: executedActions.filter(a => a.executed).length,
      automationLevel: this.config.automationLevel
    });

    return executedActions;
  }

  /**
   * Audita execução do agente
   */
  protected async auditExecution(
    executionId: string,
    findings: Finding[],
    actions: Action[]
  ): Promise<void> {
    const auditLog: AIAuditLog = {
      id: uuidv4(),
      agentType: this.agentType,
      action: 'analysis_executed',
      dataAccessed: this.getDataTypesAccessed(),
      sanitized: true,
      timestamp: new Date(),
      executionId,
      result: 'success',
      details: {
        findingsCount: findings.length,
        actionsCount: actions.length,
        actionsExecuted: actions.filter(a => a.executed).length
      }
    };

    // TODO: Persistir auditLog no Supabase
    logger.info(`${this.agentType} execution audited`, {
      executionId,
      findingsCount: findings.length,
      actionsCount: actions.length,
      actionsExecuted: actions.filter(a => a.executed).length,
      dataTypesAccessed: auditLog.dataAccessed.length
    });
  }

  /**
   * Obtém o system prompt para este agente
   */
  protected getSystemPrompt(): string {
    return PromptTemplates.getSystemPrompt(this.agentType);
  }

  /**
   * Obtém status atual do agente
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Obtém configuração do agente
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração do agente
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info(`${this.agentType} config updated`, {
      enabled: this.config.enabled,
      automationLevel: this.config.automationLevel,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });
  }

  // ===== MÉTODOS ABSTRATOS (devem ser implementados pelos agentes específicos) =====

  /**
   * Coleta dados para análise (específico de cada agente)
   */
  protected abstract collectData(): Promise<any>;

  /**
   * Sanitiza dados coletados (específico de cada agente)
   */
  protected abstract sanitizeData(rawData: any): any;

  /**
   * Analisa dados com LLM (específico de cada agente)
   */
  protected abstract analyze(sanitizedData: any): Promise<any>;

  /**
   * Cria findings a partir da análise (específico de cada agente)
   */
  protected abstract createFindings(analysisResult: any): Finding[];

  /**
   * Cria ações a partir dos findings (específico de cada agente)
   */
  protected abstract createActions(findings: Finding[]): Action[];

  /**
   * Executa uma ação específica (específico de cada agente)
   */
  protected abstract performAction(action: Action): Promise<string>;

  /**
   * Retorna tipos de dados acessados (para auditoria)
   */
  protected abstract getDataTypesAccessed(): string[];
}

