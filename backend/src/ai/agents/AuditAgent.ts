/**
 * AuditAgent - Agente de Auditoria de Segurança
 * 
 * Responsável por:
 * - Análise contínua de logs de sistema
 * - Detecção de padrões suspeitos
 * - Identificação de comportamentos anômalos
 * - Análise de tentativas de acesso
 * - Geração de relatórios de auditoria
 */

import { ContextAwareAgent } from './base/ContextAwareAgent';
import { 
  AgentType, 
  AgentConfig, 
  AgentResult,
  Finding,
  Action,
  ActionType,
  SeverityLevel,
  AIAuditLog
} from '../types';
import { DataSanitizer } from '../sanitizer/DataSanitizer';
import { ReportGenerator } from '../reports/ReportGenerator';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AuditAnalysisInput {
  logs: any[];
  timeRange: {
    start: Date;
    end: Date;
  };
  focusAreas?: ('authentication' | 'vault_access' | 'data_modification' | 'suspicious_patterns')[];
}

export interface AuditFinding {
  type: 'anomaly' | 'suspicious_pattern' | 'policy_violation' | 'security_concern';
  description: string;
  affectedResources: string[];
  evidence: string[];
  recommendations: string[];
}

export class AuditAgent extends ContextAwareAgent {
  private reportGenerator: ReportGenerator;

  constructor(config?: Partial<AgentConfig>) {
    super(AgentType.AUDIT, config);
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Executa análise de auditoria completa
   */
  async analyze(input: AuditAnalysisInput): Promise<AgentResult> {
    const executionId = uuidv4();
    const startTime = Date.now();

    try {
      logger.info('Starting audit analysis', {
        executionId,
        logCount: input.logs.length,
        timeRange: input.timeRange,
        focusAreas: input.focusAreas
      });

      // 1. Validar entrada
      this.validateInput(input);

      // 2. Sanitizar dados sensíveis
      const sanitizedLogs = await this.sanitizeLogs(input.logs);

      // 3. Carregar contexto necessário (TODO: Implementar carregamento de contexto)
      // await this.loadRequiredContext([
      //   'SECURITY-IMPLEMENTATION.md',
      //   'docs/implementacao-ia/04-ANALISE-MCP-SECURITY.md',
      //   'docs/implementacao-ia/05-PENTEST-AUTOMATIZADO.md'
      // ]);

      // 4. Analisar padrões suspeitos
      const findings = await this.detectSuspiciousPatterns(sanitizedLogs, input);

      // 5. Analisar comportamentos anômalos
      const anomalies = await this.detectAnomalies(sanitizedLogs, input);

      // 6. Combinar resultados
      const allFindings = [...findings, ...anomalies];

      // 7. Gerar recomendações e ações
      const actions = await this.generateActions(allFindings);

      // 8. Criar resultado
      const result: AgentResult = {
        executionId,
        agentType: AgentType.AUDIT,
        timestamp: new Date(),
        status: 'completed',
        findings: allFindings,
        actions,
        summary: this.generateSummary(allFindings, actions),
        metrics: {
          logsAnalyzed: input.logs.length,
          findingsCount: allFindings.length,
          criticalFindings: allFindings.filter(f => f.severity === SeverityLevel.CRITICAL).length,
          executionTime: Date.now() - startTime
        }
      };

      // 9. Gerar relatórios
      await this.reportGenerator.generateReport(result, AgentType.AUDIT);

      // 10. Registrar auditoria
      await this.logAudit(result);

      logger.info('Audit analysis completed', {
        executionId,
        findingsCount: allFindings.length,
        executionTime: result.metrics.executionTime
      });

      return result;

    } catch (error: any) {
      logger.error('Audit analysis failed', {
        executionId,
        error: error.message,
        stack: error.stack
      });

      return {
        executionId,
        agentType: AgentType.AUDIT,
        timestamp: new Date(),
        status: 'failed',
        findings: [],
        actions: [],
        summary: `Análise falhou: ${error.message}`,
        metrics: {
          logsAnalyzed: 0,
          findingsCount: 0,
          criticalFindings: 0,
          executionTime: Date.now() - startTime
        },
        error: error.message
      };
    }
  }

  /**
   * Valida entrada da análise
   */
  private validateInput(input: AuditAnalysisInput): void {
    if (!input.logs || !Array.isArray(input.logs)) {
      throw new Error('Logs must be an array');
    }

    if (input.logs.length === 0) {
      throw new Error('No logs provided for analysis');
    }

    if (!input.timeRange || !input.timeRange.start || !input.timeRange.end) {
      throw new Error('Invalid time range');
    }

    if (input.timeRange.start >= input.timeRange.end) {
      throw new Error('Start time must be before end time');
    }

    logger.debug('Input validation passed', {
      logCount: input.logs.length,
      timeRange: input.timeRange
    });
  }

  /**
   * Sanitiza logs antes da análise por IA
   */
  private async sanitizeLogs(logs: any[]): Promise<any[]> {
    logger.debug('Sanitizing logs', { count: logs.length });

    const sanitized = logs.map(log => DataSanitizer.sanitize(log));

    logger.info('Logs sanitized', {
      original: logs.length,
      sanitized: sanitized.length
    });

    return sanitized;
  }

  /**
   * Detecta padrões suspeitos usando IA
   */
  private async detectSuspiciousPatterns(
    sanitizedLogs: any[],
    input: AuditAnalysisInput
  ): Promise<Finding[]> {
    logger.debug('Detecting suspicious patterns');

    // Agrupar logs por tipo
    const logsByType = this.groupLogsByType(sanitizedLogs);

    // Preparar prompt para IA
    const prompt = this.buildSuspiciousPatternPrompt(logsByType, input);

    // Consultar IA
    const llmResponse = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getSystemPrompt(),
      temperature: 0.3, // Baixa temperatura para análise mais determinística
      maxTokens: 1024
    });

    // Parsear resposta da IA
    const findings = this.parseAIFindingsResponse(llmResponse.response, 'suspicious_pattern');

    logger.info('Suspicious patterns detected', {
      count: findings.length,
      critical: findings.filter(f => f.severity === SeverityLevel.CRITICAL).length
    });

    return findings;
  }

  /**
   * Detecta anomalias usando IA
   */
  private async detectAnomalies(
    sanitizedLogs: any[],
    input: AuditAnalysisInput
  ): Promise<Finding[]> {
    logger.debug('Detecting anomalies');

    // Calcular estatísticas baseline
    const baseline = this.calculateBaseline(sanitizedLogs);

    // Identificar desvios significativos
    const deviations = this.findDeviations(sanitizedLogs, baseline);

    if (deviations.length === 0) {
      logger.info('No significant deviations found');
      return [];
    }

    // Preparar prompt para IA analisar desvios
    const prompt = this.buildAnomalyDetectionPrompt(deviations, baseline);

    // Consultar IA
    const llmResponse = await this.llmClient.generate({
      prompt,
      systemPrompt: this.getSystemPrompt(),
      temperature: 0.3,
      maxTokens: 1024
    });

    // Parsear resposta
    const findings = this.parseAIFindingsResponse(llmResponse.response, 'anomaly');

    logger.info('Anomalies detected', {
      count: findings.length,
      high: findings.filter(f => f.severity === SeverityLevel.HIGH).length
    });

    return findings;
  }

  /**
   * Gera ações baseadas nos findings
   */
  private async generateActions(findings: Finding[]): Promise<Action[]> {
    const actions: Action[] = [];

    for (const finding of findings) {
      // Ações automáticas apenas para severidade CRÍTICA
      if (finding.severity === SeverityLevel.CRITICAL) {
        actions.push({
          type: ActionType.ALERT,
          description: `🚨 ALERTA CRÍTICO: ${finding.description}`,
          automated: true,
          requiresApproval: false,
          priority: 'high',
          estimatedImpact: 'Segurança comprometida - ação imediata necessária'
        });

        // Sugerir bloqueio se for acesso suspeito
        if (finding.category === 'access_control' || finding.category === 'authentication') {
          actions.push({
            type: ActionType.BLOCK,
            description: `Bloquear recursos afetados: ${finding.affectedResources.join(', ')}`,
            automated: false, // Requer aprovação manual
            requiresApproval: true,
            priority: 'high',
            estimatedImpact: 'Pode bloquear acessos legítimos - requer análise'
          });
        }
      }

      // Ações de log para todas as severidades
      if (finding.severity >= SeverityLevel.MEDIUM) {
        actions.push({
          type: ActionType.LOG,
          description: `Registrar finding: ${finding.title}`,
          automated: true,
          requiresApproval: false,
          priority: finding.severity === SeverityLevel.HIGH ? 'high' : 'medium',
          estimatedImpact: 'Rastreabilidade e compliance'
        });
      }

      // Notificações para severidades altas
      if (finding.severity >= SeverityLevel.HIGH) {
        actions.push({
          type: ActionType.NOTIFY,
          description: `Notificar administrador sobre: ${finding.title}`,
          automated: true,
          requiresApproval: false,
          priority: finding.severity === SeverityLevel.CRITICAL ? 'high' : 'medium',
          estimatedImpact: 'Visibilidade e resposta rápida'
        });
      }
    }

    logger.info('Actions generated', {
      total: actions.length,
      automated: actions.filter(a => a.automated).length,
      requiresApproval: actions.filter(a => a.requiresApproval).length
    });

    return actions;
  }

  /**
   * Agrupa logs por tipo
   */
  private groupLogsByType(logs: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {
      authentication: [],
      vault_access: [],
      api_requests: [],
      errors: [],
      other: []
    };

    for (const log of logs) {
      const type = this.classifyLogType(log);
      grouped[type].push(log);
    }

    return grouped;
  }

  /**
   * Classifica tipo de log
   */
  private classifyLogType(log: any): string {
    if (log.action?.includes('login') || log.action?.includes('auth')) {
      return 'authentication';
    }
    if (log.action?.includes('vault') || log.resource?.includes('vault')) {
      return 'vault_access';
    }
    if (log.level === 'error' || log.status >= 400) {
      return 'errors';
    }
    if (log.method && log.path) {
      return 'api_requests';
    }
    return 'other';
  }

  /**
   * Constrói prompt para detecção de padrões suspeitos
   */
  private buildSuspiciousPatternPrompt(
    logsByType: Record<string, any[]>,
    input: AuditAnalysisInput
  ): string {
    return `
ANÁLISE DE AUDITORIA DE SEGURANÇA - DETECÇÃO DE PADRÕES SUSPEITOS

CONTEXTO:
- Período: ${input.timeRange.start.toISOString()} até ${input.timeRange.end.toISOString()}
- Total de logs: ${Object.values(logsByType).flat().length}

LOGS POR CATEGORIA:
${Object.entries(logsByType)
  .map(([type, logs]) => `- ${type}: ${logs.length} eventos`)
  .join('\n')}

FOCUS AREAS: ${input.focusAreas?.join(', ') || 'Todas'}

DADOS SANITIZADOS:
${JSON.stringify(logsByType, null, 2).substring(0, 2000)}

TAREFA:
Analise os logs sanitizados e identifique padrões suspeitos que possam indicar:
1. Tentativas de força bruta
2. Varredura de vulnerabilidades
3. Acessos não autorizados
4. Comportamento de bot/automação maliciosa
5. Exfiltração de dados
6. Privilege escalation

Para cada padrão suspeito identificado, retorne no formato JSON:
{
  "findings": [
    {
      "title": "Título curto e descritivo",
      "description": "Descrição detalhada do padrão",
      "severity": "critical|high|medium|low",
      "category": "authentication|access_control|data_protection|compliance",
      "affectedResources": ["recurso1", "recurso2"],
      "evidence": ["evidência1", "evidência2"],
      "recommendation": "O que fazer para mitigar"
    }
  ]
}

IMPORTANTE: Retorne APENAS o JSON válido, sem texto adicional.
`.trim();
  }

  /**
   * Constrói prompt para detecção de anomalias
   */
  private buildAnomalyDetectionPrompt(deviations: any[], baseline: any): string {
    return `
ANÁLISE DE AUDITORIA - DETECÇÃO DE ANOMALIAS

BASELINE (Comportamento Normal):
${JSON.stringify(baseline, null, 2)}

DESVIOS DETECTADOS:
${JSON.stringify(deviations, null, 2)}

TAREFA:
Analise os desvios em relação ao baseline e identifique anomalias que possam indicar:
1. Picos incomuns de atividade
2. Acessos fora do horário normal
3. Mudanças repentinas em padrões de uso
4. Comportamento inconsistente com o perfil do usuário

Para cada anomalia, retorne no formato JSON:
{
  "findings": [
    {
      "title": "Título da anomalia",
      "description": "Descrição detalhada",
      "severity": "critical|high|medium|low",
      "category": "anomaly_detection",
      "affectedResources": ["recurso"],
      "evidence": ["evidência"],
      "recommendation": "Recomendação"
    }
  ]
}

IMPORTANTE: Retorne APENAS o JSON válido.
`.trim();
  }

  /**
   * Calcula baseline estatístico
   */
  private calculateBaseline(logs: any[]): any {
    const hourCounts: Record<number, number> = {};
    const actionCounts: Record<string, number> = {};
    const statusCounts: Record<number, number> = {};

    for (const log of logs) {
      // Contagem por hora
      if (log.timestamp) {
        const hour = new Date(log.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }

      // Contagem por ação
      if (log.action) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      }

      // Contagem por status
      if (log.status) {
        statusCounts[log.status] = (statusCounts[log.status] || 0) + 1;
      }
    }

    return {
      totalLogs: logs.length,
      hourCounts,
      actionCounts,
      statusCounts,
      avgLogsPerHour: Object.values(hourCounts).reduce((a, b) => a + b, 0) / Object.keys(hourCounts).length
    };
  }

  /**
   * Encontra desvios significativos
   */
  private findDeviations(logs: any[], baseline: any): any[] {
    const deviations: any[] = [];
    const threshold = 2.0; // 2x desvio padrão

    // Desvios por hora
    for (const [hour, count] of Object.entries(baseline.hourCounts) as [string, number][]) {
      if (count > baseline.avgLogsPerHour * threshold) {
        deviations.push({
          type: 'hour_spike',
          hour: parseInt(hour),
          count,
          expected: baseline.avgLogsPerHour,
          deviation: ((count - baseline.avgLogsPerHour) / baseline.avgLogsPerHour * 100).toFixed(2) + '%'
        });
      }
    }

    // Falhas consecutivas
    let consecutiveFailures = 0;
    for (const log of logs) {
      if (log.status >= 400) {
        consecutiveFailures++;
        if (consecutiveFailures >= 5) {
          deviations.push({
            type: 'consecutive_failures',
            count: consecutiveFailures,
            lastFailure: log
          });
          break;
        }
      } else {
        consecutiveFailures = 0;
      }
    }

    return deviations;
  }

  /**
   * Parseia resposta da IA em findings estruturados
   */
  private parseAIFindingsResponse(response: string, defaultCategory: string): Finding[] {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in AI response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.findings || !Array.isArray(parsed.findings)) {
        logger.warn('Invalid findings structure');
        return [];
      }

      // Converter para Finding[]
      return parsed.findings.map((f: any) => ({
        id: uuidv4(),
        title: f.title || 'Unknown Finding',
        description: f.description || '',
        severity: this.parseSeverity(f.severity),
        category: f.category || defaultCategory,
        affectedResources: f.affectedResources || [],
        evidence: f.evidence || [],
        recommendations: Array.isArray(f.recommendation) 
          ? f.recommendation 
          : [f.recommendation || 'Investigação manual recomendada'],
        timestamp: new Date()
      }));

    } catch (error: any) {
      logger.error('Failed to parse AI findings', {
        error: error.message,
        response: response.substring(0, 200)
      });
      return [];
    }
  }

  /**
   * Parseia severidade
   */
  private parseSeverity(severity: string): SeverityLevel {
    const map: Record<string, SeverityLevel> = {
      'critical': SeverityLevel.CRITICAL,
      'high': SeverityLevel.HIGH,
      'medium': SeverityLevel.MEDIUM,
      'low': SeverityLevel.LOW
    };
    return map[severity?.toLowerCase()] || SeverityLevel.MEDIUM;
  }

  /**
   * Gera resumo executivo
   */
  private generateSummary(findings: Finding[], actions: Action[]): string {
    const critical = findings.filter(f => f.severity === SeverityLevel.CRITICAL).length;
    const high = findings.filter(f => f.severity === SeverityLevel.HIGH).length;
    const medium = findings.filter(f => f.severity === SeverityLevel.MEDIUM).length;

    return `
Análise de Auditoria Concluída

📊 RESULTADOS:
- Total de findings: ${findings.length}
- Críticos: ${critical}
- Altos: ${high}
- Médios: ${medium}

🎯 AÇÕES GERADAS:
- Total: ${actions.length}
- Automáticas: ${actions.filter(a => a.automated).length}
- Requerem aprovação: ${actions.filter(a => a.requiresApproval).length}

${critical > 0 ? '🚨 ATENÇÃO: Findings críticos detectados! Ação imediata necessária.' : '✅ Nenhum finding crítico detectado.'}
`.trim();
  }

  /**
   * Obtém system prompt para IA
   */
  private getSystemPrompt(): string {
    return `
Você é um especialista em segurança cibernética analisando logs de auditoria do SafeBox, 
um sistema de gerenciamento de senhas zero-knowledge.

PRINCÍPIOS:
1. Privacidade: Dados já foram sanitizados, mas mantenha foco em padrões, não em dados
2. Zero-Knowledge: Nunca peça ou mencione senhas ou dados não criptografados
3. Segurança: Seja conservador - melhor um falso positivo que perder um ataque real
4. Clareza: Explique findings de forma clara e acionável

CONTEXTO DO SISTEMA:
${this.context?.content.substring(0, 500) || 'Sistema de gerenciamento de senhas com arquitetura zero-knowledge'}

Responda SEMPRE em JSON válido conforme solicitado.
`.trim();
  }

  /**
   * Registra auditoria da própria análise
   */
  private async logAudit(result: AgentResult): Promise<void> {
    const auditLog: AIAuditLog = {
      id: uuidv4(),
      agentType: AgentType.AUDIT,
      action: 'audit_analysis',
      timestamp: new Date(),
      userId: 'system',
      inputHash: 'sanitized',
      outputHash: 'sanitized',
      decision: result.status,
      confidence: 0.85,
      reasoning: result.summary,
      reviewStatus: 'pending'
    };

    logger.info('Audit log created', { auditLog });

    // TODO: Persistir no Supabase quando integração estiver pronta
  }
}

