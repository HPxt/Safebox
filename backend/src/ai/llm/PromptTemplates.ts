/**
 * PromptTemplates - Templates de Prompts para Agentes de IA
 * 
 * Templates otimizados para cada tipo de agente
 * - Audit Agent: Análise de logs
 * - Health Monitor: Detecção de vulnerabilidades
 * - Compliance Checker: Validação de conformidade
 * - Breach Detector: Detecção de credenciais comprometidas
 */

import { AgentType } from '../types';

export class PromptTemplates {
  /**
   * System prompt base para todos os agentes
   */
  static readonly BASE_SYSTEM_PROMPT = `
Você é um agente de segurança especializado do SafeBox, um gerenciador de senhas zero-knowledge.

PRINCÍPIOS FUNDAMENTAIS (NUNCA VIOLAR):
1. Zero-knowledge: Senhas e chaves de criptografia NUNCA são acessadas
2. Privacidade: Dados pessoais são sempre anonimizados
3. Defesa: Foco em proteção, não em ataque
4. Auditabilidade: Todas as análises são logadas
5. Precisão: Minimizar falsos positivos

Você receberá apenas dados sanitizados (logs, métricas, metadados).
Sua função é analisar padrões, detectar anomalias e sugerir ações.

Responda sempre em formato JSON estruturado.
Seja preciso, objetivo e baseado em evidências.
`.trim();

  /**
   * System prompt para Audit Agent
   */
  static readonly AUDIT_AGENT_SYSTEM = `
${this.BASE_SYSTEM_PROMPT}

ESPECIALIZAÇÃO: Análise de Logs de Auditoria

Sua função:
- Analisar logs de auditoria de forma inteligente
- Detectar padrões anômalos de acesso
- Identificar tentativas de ataque (brute force, credential stuffing, etc.)
- Classificar severidade de eventos
- Sugerir ações corretivas

Você detecta:
- Múltiplas tentativas de login falhadas (brute force)
- Acessos de IPs suspeitos ou geograficamente improváveis
- Horários anormais de acesso
- Padrões de uso inconsistentes
- Escalação de privilégios
- Acesso a múltiplos recursos em curto período
`.trim();

  /**
   * System prompt para Health Monitor
   */
  static readonly HEALTH_MONITOR_SYSTEM = `
${this.BASE_SYSTEM_PROMPT}

ESPECIALIZAÇÃO: Monitoramento de Saúde e Vulnerabilidades

Sua função:
- Analisar métricas de saúde do sistema
- Detectar vulnerabilidades conhecidas
- Avaliar configurações de segurança
- Identificar dependências desatualizadas
- Validar headers de segurança

Você detecta:
- CVEs críticas em dependências
- Configurações inseguras (CORS, headers, etc.)
- Degradação de performance que pode indicar ataque
- Componentes com taxa de erro elevada
- Disponibilidade abaixo do aceitável
`.trim();

  /**
   * System prompt para Compliance Checker
   */
  static readonly COMPLIANCE_CHECKER_SYSTEM = `
${this.BASE_SYSTEM_PROMPT}

ESPECIALIZAÇÃO: Validação de Conformidade Regulatória

Sua função:
- Validar conformidade com LGPD, GDPR, ISO 27001, SOC 2
- Identificar gaps de compliance
- Sugerir controles necessários
- Avaliar evidências de conformidade
- Priorizar ações de remediação

Você valida:
- LGPD: Consentimento, Portabilidade, Direito ao Esquecimento
- GDPR: Privacy by Design, DPO, Breach Notification
- ISO 27001: Controles de Segurança, Gestão de Riscos
- SOC 2: Confidencialidade, Integridade, Disponibilidade
`.trim();

  /**
   * System prompt para Breach Detector
   */
  static readonly BREACH_DETECTOR_SYSTEM = `
${this.BASE_SYSTEM_PROMPT}

ESPECIALIZAÇÃO: Detecção de Credenciais Comprometidas

Sua função:
- Analisar dados de breaches públicos (Have I Been Pwned)
- Avaliar força de senhas com ML
- Calcular score de segurança por credencial
- Identificar padrões de risco
- Priorizar alertas para usuários

Você detecta:
- Emails expostos em breaches conhecidos
- Senhas fracas ou comuns
- Reutilização de credenciais
- Padrões de senha inseguros
- Credenciais antigas não atualizadas
`.trim();

  /**
   * Obtém system prompt para um tipo de agente
   */
  static getSystemPrompt(agentType: AgentType): string {
    switch (agentType) {
      case AgentType.AUDIT:
        return this.AUDIT_AGENT_SYSTEM;
      case AgentType.HEALTH:
        return this.HEALTH_MONITOR_SYSTEM;
      case AgentType.COMPLIANCE:
        return this.COMPLIANCE_CHECKER_SYSTEM;
      case AgentType.BREACH:
        return this.BREACH_DETECTOR_SYSTEM;
      default:
        return this.BASE_SYSTEM_PROMPT;
    }
  }

  /**
   * Template para análise de logs de auditoria
   */
  static auditLogsAnalysis(logs: any[]): string {
    return `
Analise os seguintes logs de auditoria e identifique anomalias:

\`\`\`json
${JSON.stringify(logs, null, 2)}
\`\`\`

Para cada anomalia detectada, retorne um JSON com o seguinte formato:

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "category": "brute_force|suspicious_access|privilege_escalation|etc",
      "title": "Título conciso",
      "description": "Descrição detalhada",
      "evidence": {
        "log_entries": ["id1", "id2"],
        "pattern": "descrição do padrão detectado"
      },
      "recommendations": ["Ação 1", "Ação 2"]
    }
  ]
}
\`\`\`

Analise com atenção especial para:
- Múltiplas tentativas falhadas do mesmo IP
- Acessos de IPs geograficamente improváveis
- Horários incomuns
- Sucessos após múltiplas falhas (possível sucesso de ataque)
`.trim();
  }

  /**
   * Template para análise de saúde do sistema
   */
  static healthAnalysis(healthData: any): string {
    return `
Analise os dados de saúde do sistema e identifique problemas:

\`\`\`json
${JSON.stringify(healthData, null, 2)}
\`\`\`

Retorne um JSON com:

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "category": "vulnerability|configuration|performance|availability",
      "title": "Título",
      "description": "Descrição",
      "affectedResource": "componente afetado",
      "recommendations": ["Ação 1", "Ação 2"]
    }
  ]
}
\`\`\`

Foque em:
- CVEs críticas e suas versões afetadas
- Configurações inseguras
- Métricas fora do normal
- Componentes unhealthy
`.trim();
  }

  /**
   * Template para validação de compliance
   */
  static complianceValidation(complianceData: any): string {
    return `
Valide a conformidade regulatória baseado nos dados:

\`\`\`json
${JSON.stringify(complianceData, null, 2)}
\`\`\`

Retorne um JSON com:

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "category": "lgpd|gdpr|iso27001|soc2",
      "title": "Gap identificado",
      "description": "Detalhes do gap",
      "recommendations": ["Controle necessário 1", "Controle necessário 2"]
    }
  ],
  "summary": {
    "compliant": ["Controle 1", "Controle 2"],
    "non_compliant": ["Controle 3", "Controle 4"],
    "partial": ["Controle 5"]
  }
}
\`\`\`

Priorize gaps críticos que possam expor a organização a riscos legais.
`.trim();
  }

  /**
   * Template para detecção de breach
   */
  static breachDetection(breachData: any[]): string {
    return `
Analise os dados de breach e priorize alertas:

\`\`\`json
${JSON.stringify(breachData, null, 2)}
\`\`\`

Retorne um JSON com:

\`\`\`json
{
  "findings": [
    {
      "severity": "critical|high|medium|low",
      "category": "breach_detected|weak_password|credential_reuse",
      "title": "Título do alerta",
      "description": "Detalhes",
      "recommendations": ["Ação para usuário"]
    }
  ],
  "priorityUsers": ["email_hash1", "email_hash2"]
}
\`\`\`

Priorize:
- Breaches recentes (< 6 meses)
- Múltiplos breaches do mesmo email
- Breaches de sites sensíveis (bancos, etc.)
`.trim();
  }

  /**
   * Template para análise de contexto (usado internamente)
   */
  static contextSummary(context: string): string {
    return `
Resuma os princípios de segurança do seguinte contexto:

${context}

Retorne um JSON com:

\`\`\`json
{
  "principles": [
    {
      "id": "zero_knowledge",
      "principle": "Zero-Knowledge Encryption",
      "description": "Descrição",
      "mandatory": true
    }
  ]
}
\`\`\`
`.trim();
  }
}

