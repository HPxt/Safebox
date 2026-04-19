# 🧠 Context Awareness - Agentes Inteligentes com Consciência de Contexto

> Criado em: 2025-01-06
> Versão: v1.0

## 🎯 Objetivo

Garantir que **todos os agentes e ferramentas automatizadas leiam a documentação do SafeBox** antes de executar qualquer ação, para entenderem:
- Arquitetura do projeto
- Regras de segurança
- Padrões de código
- Limitações e restrições

---

## ⚠️ Por Que Isso é Crítico?

### **Sem Context Awareness:**
❌ Agente pode tomar decisões erradas
❌ Pode violar princípios de segurança
❌ Pode não respeitar arquitetura zero-knowledge
❌ Pode introduzir vulnerabilidades
❌ Pode ignorar padrões do projeto

### **Com Context Awareness:**
✅ Decisões informadas e contextualizadas
✅ Respeito aos princípios de segurança
✅ Conformidade com arquitetura
✅ Código consistente com padrões
✅ Menor probabilidade de erros

---

## 📚 Sistema de Context Loading

### **Arquitetura:**

```
┌─────────────────────────────────────────────────────────┐
│                  Agent Initialization                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Context Loader (Obrigatório)               │
│  ┌──────────────┬──────────────┬──────────────┐        │
│  │  Project     │  Security    │  Architecture│        │
│  │  Docs        │  Policies    │  Patterns    │        │
│  └──────────────┴──────────────┴──────────────┘        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Context Validation                         │
│  ✓ All required docs loaded                            │
│  ✓ Context is up-to-date                               │
│  ✓ No conflicting information                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Agent Execution (Context-Aware)            │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Documentos Obrigatórios por Agente

### **Documentos Core (Todos os Agentes):**
```typescript
const CORE_DOCS = [
  'README.md',                           // Visão geral do projeto
  'backend/README.md',                   // Arquitetura backend
  'backend/SECURITY-IMPLEMENTATION.md',  // Políticas de segurança
  'docs/implementacao-ia/00-RESUMO-EXECUTIVO.md', // Visão de IA
  'docs/implementacao-ia/06-CONTEXT-AWARENESS.md', // Este documento!
];
```

### **Documentos Específicos por Agente:**

#### **1. Audit Agent:**
```typescript
const AUDIT_AGENT_DOCS = [
  ...CORE_DOCS,
  'backend/src/utils/logger.ts',         // Sistema de logs
  'backend/src/middleware/auth.middleware.ts', // Autenticação
  'backend/logs/audit.log',              // Formato de logs (exemplo)
  'docs/implementacao-ia/03-BATERIA-TESTES.md', // Testes esperados
];
```

#### **2. Breach Detector:**
```typescript
const BREACH_DETECTOR_DOCS = [
  ...CORE_DOCS,
  'frontend/src/utils/crypto.ts',        // Sistema de criptografia
  'backend/src/services/auth.service.ts', // Gerenciamento de usuários
  'docs/implementacao-ia/03-BATERIA-TESTES.md',
];
```

#### **3. Health Monitor:**
```typescript
const HEALTH_MONITOR_DOCS = [
  ...CORE_DOCS,
  'backend/src/middleware/security.middleware.ts', // Middlewares
  'backend/src/middleware/rateLimiting.middleware.ts',
  'backend/src/index.ts',                // Configuração do servidor
  'docs/implementacao-ia/05-PENTEST-AUTOMATIZADO.md', // Pentest config
];
```

#### **4. Compliance Checker:**
```typescript
const COMPLIANCE_CHECKER_DOCS = [
  ...CORE_DOCS,
  'backend/SECURITY-IMPLEMENTATION.md',  // Implementações
  'docs/implementacao-ia/01-PLANO-INTEGRACAO.md', // Plano completo
  'docs/implementacao-ia/03-BATERIA-TESTES.md',
];
```

#### **5. Pentest Agent:**
```typescript
const PENTEST_AGENT_DOCS = [
  ...CORE_DOCS,
  'docs/implementacao-ia/05-PENTEST-AUTOMATIZADO.md', // Config de pentest
  'backend/src/middleware/security.middleware.ts',
  'backend/src/config/environment.ts',   // Variáveis de ambiente
];
```

---

## 🛠️ Implementação do Context Loader

### **Classe Base para Todos os Agentes:**

```typescript
// backend/src/services/ai/base/context-aware-agent.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '@/utils/logger';

interface AgentContext {
  projectName: string;
  architecture: string;
  securityPrinciples: string[];
  restrictions: string[];
  patterns: Record<string, string>;
  lastUpdated: Date;
}

export abstract class ContextAwareAgent {
  protected context: AgentContext | null = null;
  protected contextLoaded = false;
  
  // Documentos obrigatórios (override em subclasses)
  protected abstract getRequiredDocs(): string[];
  
  // Nome do agente (override em subclasses)
  protected abstract getAgentName(): string;
  
  /**
   * Carrega contexto ANTES de qualquer operação
   * MUST BE CALLED before any agent action
   */
  protected async loadContext(): Promise<void> {
    if (this.contextLoaded) {
      logger.debug(`${this.getAgentName()}: Context already loaded`);
      return;
    }
    
    logger.info(`${this.getAgentName()}: Loading context...`);
    
    const requiredDocs = this.getRequiredDocs();
    const docs: Record<string, string> = {};
    
    // Carregar todos os documentos obrigatórios
    for (const docPath of requiredDocs) {
      try {
        const fullPath = path.join(process.cwd(), docPath);
        const content = await fs.readFile(fullPath, 'utf-8');
        docs[docPath] = content;
        logger.debug(`${this.getAgentName()}: Loaded ${docPath}`);
      } catch (error) {
        logger.error(`${this.getAgentName()}: Failed to load ${docPath}`, error);
        throw new Error(
          `Context loading failed: Cannot read required doc ${docPath}`
        );
      }
    }
    
    // Extrair informações críticas dos documentos
    this.context = await this.parseContext(docs);
    this.contextLoaded = true;
    
    // Validar contexto
    await this.validateContext();
    
    logger.info(`${this.getAgentName()}: Context loaded successfully`);
    
    // Log de auditoria
    await this.logContextLoad();
  }
  
  /**
   * Parse documentos para extrair informações estruturadas
   */
  protected async parseContext(docs: Record<string, string>): Promise<AgentContext> {
    // Extrair princípios de segurança do README
    const securitySection = this.extractSection(
      docs['backend/SECURITY-IMPLEMENTATION.md'],
      '## Princípios'
    );
    
    const securityPrinciples = this.extractBulletPoints(securitySection);
    
    // Extrair restrições
    const restrictionsSection = this.extractSection(
      docs['docs/implementacao-ia/00-RESUMO-EXECUTIVO.md'],
      '## O que NÃO vamos usar'
    );
    
    const restrictions = this.extractBulletPoints(restrictionsSection);
    
    return {
      projectName: 'SafeBox',
      architecture: 'zero-knowledge',
      securityPrinciples,
      restrictions,
      patterns: this.extractPatterns(docs),
      lastUpdated: new Date(),
    };
  }
  
  /**
   * Valida que o contexto está completo e consistente
   */
  protected async validateContext(): Promise<void> {
    if (!this.context) {
      throw new Error('Context is null after loading');
    }
    
    // Verificações críticas
    if (!this.context.securityPrinciples.length) {
      throw new Error('No security principles found in context');
    }
    
    if (this.context.architecture !== 'zero-knowledge') {
      throw new Error('Architecture mismatch: Expected zero-knowledge');
    }
    
    // Verificar que princípios críticos estão presentes
    const criticalPrinciples = [
      'zero-knowledge',
      'sanitização',
      'auditabilidade',
    ];
    
    for (const principle of criticalPrinciples) {
      const found = this.context.securityPrinciples.some(p =>
        p.toLowerCase().includes(principle)
      );
      
      if (!found) {
        logger.warn(
          `${this.getAgentName()}: Critical principle "${principle}" not found in context`
        );
      }
    }
  }
  
  /**
   * Garante que contexto está carregado antes de executar ação
   */
  protected async ensureContext(): Promise<void> {
    if (!this.contextLoaded) {
      await this.loadContext();
    }
    
    // Verificar se contexto está atualizado (max 24h)
    const age = Date.now() - this.context!.lastUpdated.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas
    
    if (age > maxAge) {
      logger.info(`${this.getAgentName()}: Context is stale, reloading...`);
      this.contextLoaded = false;
      await this.loadContext();
    }
  }
  
  /**
   * Verifica se uma ação viola princípios de segurança
   */
  protected checkSecurityViolation(action: string): boolean {
    if (!this.context) {
      throw new Error('Context not loaded');
    }
    
    // Verificar contra restrições conhecidas
    const violations = this.context.restrictions.filter(restriction =>
      action.toLowerCase().includes(restriction.toLowerCase())
    );
    
    if (violations.length > 0) {
      logger.error(
        `${this.getAgentName()}: Action violates restrictions: ${violations.join(', ')}`
      );
      return true;
    }
    
    return false;
  }
  
  /**
   * Helper: Extrair seção de um markdown
   */
  private extractSection(content: string, heading: string): string {
    const lines = content.split('\n');
    const startIndex = lines.findIndex(line => line.includes(heading));
    
    if (startIndex === -1) return '';
    
    // Encontrar próximo heading do mesmo nível ou maior
    const headingLevel = heading.match(/^#+/)?.[0].length || 2;
    const endIndex = lines.findIndex((line, idx) => {
      if (idx <= startIndex) return false;
      const match = line.match(/^#+/);
      return match && match[0].length <= headingLevel;
    });
    
    return lines
      .slice(startIndex + 1, endIndex === -1 ? undefined : endIndex)
      .join('\n');
  }
  
  /**
   * Helper: Extrair bullet points de uma seção
   */
  private extractBulletPoints(section: string): string[] {
    return section
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[\s\-\*]+/, '').trim())
      .filter(line => line.length > 0);
  }
  
  /**
   * Helper: Extrair padrões de código dos docs
   */
  private extractPatterns(docs: Record<string, string>): Record<string, string> {
    // Implementar extração de padrões de código
    // Ex: logging patterns, error handling, etc.
    return {};
  }
  
  /**
   * Log de auditoria do carregamento de contexto
   */
  private async logContextLoad(): Promise<void> {
    await logger.info(`${this.getAgentName()}: Context loaded`, {
      event: 'context_loaded',
      agent: this.getAgentName(),
      docs_count: this.getRequiredDocs().length,
      principles_count: this.context!.securityPrinciples.length,
      restrictions_count: this.context!.restrictions.length,
    });
  }
}
```

---

### **Exemplo de Implementação: Audit Agent**

```typescript
// backend/src/services/ai/audit-agent.service.ts
import { ContextAwareAgent } from './base/context-aware-agent';

export class AuditAgent extends ContextAwareAgent {
  protected getAgentName(): string {
    return 'AuditAgent';
  }
  
  protected getRequiredDocs(): string[] {
    return [
      'README.md',
      'backend/README.md',
      'backend/SECURITY-IMPLEMENTATION.md',
      'backend/src/utils/logger.ts',
      'backend/src/middleware/auth.middleware.ts',
      'docs/implementacao-ia/00-RESUMO-EXECUTIVO.md',
      'docs/implementacao-ia/01-PLANO-INTEGRACAO.md',
      'docs/implementacao-ia/03-BATERIA-TESTES.md',
      'docs/implementacao-ia/06-CONTEXT-AWARENESS.md',
    ];
  }
  
  /**
   * Analisa logs de auditoria
   * SEMPRE carrega contexto antes de executar
   */
  async analyzeLogs(logs: AuditLog[]): Promise<AuditAnalysis> {
    // CRÍTICO: Carregar contexto primeiro
    await this.ensureContext();
    
    logger.info('AuditAgent: Analyzing logs with context awareness');
    
    // Verificar se a análise solicitada não viola princípios
    if (this.containsSensitiveData(logs)) {
      throw new Error(
        'Cannot analyze: Logs contain sensitive data that violates zero-knowledge principle'
      );
    }
    
    // Usar contexto para análise informada
    const analysis = await this.performContextAwareAnalysis(logs);
    
    // Validar resultados contra princípios de segurança
    this.validateAnalysisResults(analysis);
    
    return analysis;
  }
  
  private async performContextAwareAnalysis(logs: AuditLog[]): Promise<AuditAnalysis> {
    // Usar princípios de segurança do contexto
    const { securityPrinciples } = this.context!;
    
    // Exemplo: Verificar padrões de ataque mencionados nos docs
    const anomalies = logs.filter(log => {
      // Usar conhecimento do contexto para detectar anomalias
      return this.isAnomalousBasedOnContext(log);
    });
    
    return {
      totalLogs: logs.length,
      anomalies: anomalies.length,
      findings: anomalies.map(log => this.createFinding(log)),
      recommendations: this.generateContextAwareRecommendations(anomalies),
    };
  }
  
  private containsSensitiveData(logs: AuditLog[]): boolean {
    // Verificar contra lista de campos sensíveis no contexto
    const sensitiveFields = ['password', 'encrypted_data', 'master_key', 'salt'];
    
    return logs.some(log =>
      sensitiveFields.some(field => Object.keys(log).includes(field))
    );
  }
  
  private validateAnalysisResults(analysis: AuditAnalysis): void {
    // Garantir que análise não contém dados sensíveis
    const analysisStr = JSON.stringify(analysis);
    
    if (analysisStr.includes('password') || analysisStr.includes('key')) {
      throw new Error(
        'Analysis results contain sensitive data - violates context requirements'
      );
    }
  }
}
```

---

### **Sistema de Refresh Automático de Contexto**

```typescript
// backend/src/services/ai/context-manager.service.ts
export class ContextManager {
  private static instance: ContextManager;
  private agents: Map<string, ContextAwareAgent> = new Map();
  
  static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }
  
  /**
   * Registra um agente para gerenciamento de contexto
   */
  registerAgent(agent: ContextAwareAgent): void {
    const name = agent['getAgentName']();
    this.agents.set(name, agent);
    logger.info(`ContextManager: Registered agent ${name}`);
  }
  
  /**
   * Force reload de contexto em todos os agentes
   * Útil quando documentação é atualizada
   */
  async reloadAllContexts(): Promise<void> {
    logger.info('ContextManager: Reloading all agent contexts...');
    
    for (const [name, agent] of this.agents.entries()) {
      try {
        agent['contextLoaded'] = false; // Force reload
        await agent['loadContext']();
        logger.info(`ContextManager: Reloaded context for ${name}`);
      } catch (error) {
        logger.error(`ContextManager: Failed to reload ${name}`, error);
      }
    }
  }
  
  /**
   * Monitor de mudanças nos documentos
   */
  async watchDocuments(): Promise<void> {
    const chokidar = require('chokidar');
    
    const watcher = chokidar.watch([
      'README.md',
      'backend/**/*.md',
      'docs/implementacao-ia/**/*.md',
    ], {
      ignored: /(^|[\/\\])\../,
      persistent: true
    });
    
    watcher.on('change', async (path: string) => {
      logger.info(`ContextManager: Document changed: ${path}`);
      logger.info('ContextManager: Triggering context reload for all agents');
      await this.reloadAllContexts();
    });
  }
}
```

---

## 🔒 Validação de Contexto em Runtime

### **Middleware de Validação:**

```typescript
// backend/src/middleware/context-validation.middleware.ts
export const contextValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Verificar se rota é de agente de IA
  if (!req.path.startsWith('/api/ai/')) {
    return next();
  }
  
  // Extrair agente da rota
  const agentMatch = req.path.match(/\/api\/ai\/([^\/]+)/);
  if (!agentMatch) {
    return next();
  }
  
  const agentName = agentMatch[1];
  const manager = ContextManager.getInstance();
  const agent = manager['agents'].get(agentName);
  
  if (!agent) {
    return res.status(500).json({
      error: 'Agent not found or not registered',
      agent: agentName
    });
  }
  
  // Verificar se contexto está carregado
  if (!agent['contextLoaded']) {
    logger.warn(`Context not loaded for ${agentName}, loading now...`);
    
    try {
      await agent['loadContext']();
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to load agent context',
        message: 'Agent cannot operate without context',
        details: error.message
      });
    }
  }
  
  // Adicionar contexto ao request para uso posterior
  req['agentContext'] = agent['context'];
  
  next();
};
```

---

## 📊 Dashboard de Context Status

```typescript
// backend/src/routes/ai-status.routes.ts
router.get('/api/ai/context-status', async (req, res) => {
  const manager = ContextManager.getInstance();
  
  const status = Array.from(manager['agents'].entries()).map(([name, agent]) => ({
    agent: name,
    contextLoaded: agent['contextLoaded'],
    lastUpdated: agent['context']?.lastUpdated,
    docsCount: agent['getRequiredDocs']().length,
    principlesCount: agent['context']?.securityPrinciples.length || 0,
    restrictionsCount: agent['context']?.restrictions.length || 0,
  }));
  
  res.json({
    overall: status.every(s => s.contextLoaded) ? 'healthy' : 'degraded',
    agents: status,
    timestamp: new Date(),
  });
});
```

---

## ✅ Checklist de Implementação

### **Fase 1: Base do Sistema**
- [ ] Criar `ContextAwareAgent` base class
- [ ] Implementar `ContextManager`
- [ ] Criar middleware de validação
- [ ] Implementar sistema de parsing de docs

### **Fase 2: Integração com Agentes**
- [ ] Refatorar AuditAgent para usar contexto
- [ ] Refatorar BreachDetector para usar contexto
- [ ] Refatorar HealthMonitor para usar contexto
- [ ] Refatorar ComplianceChecker para usar contexto

### **Fase 3: Monitoramento**
- [ ] Implementar file watcher para docs
- [ ] Criar dashboard de context status
- [ ] Adicionar métricas de context loading
- [ ] Configurar alertas para falhas

### **Fase 4: Testes**
- [ ] Testar carregamento de contexto
- [ ] Testar validação de contexto
- [ ] Testar detecção de violações
- [ ] Testar reload automático

---

## 🎯 Métricas de Sucesso

| Métrica | Meta | Status |
|---------|------|--------|
| **Context Load Success Rate** | 100% | 🔜 |
| **Context Staleness** | < 1h | 🔜 |
| **Violation Detection** | 100% | 🔜 |
| **Reload Time** | < 5s | 🔜 |
| **Agent Uptime com Contexto** | > 99% | 🔜 |

---

## 📝 Exemplo de Uso Completo

```typescript
// Inicialização da aplicação
async function initializeAIAgents() {
  const manager = ContextManager.getInstance();
  
  // Criar e registrar agentes
  const auditAgent = new AuditAgent();
  const breachDetector = new BreachDetector();
  const healthMonitor = new HealthMonitor();
  
  manager.registerAgent(auditAgent);
  manager.registerAgent(breachDetector);
  manager.registerAgent(healthMonitor);
  
  // Iniciar watcher de documentos
  await manager.watchDocuments();
  
  logger.info('AI Agents initialized with context awareness');
}

// Uso de um agente
async function analyzeSecurityLogs() {
  const auditAgent = new AuditAgent();
  
  // Contexto é carregado automaticamente
  const analysis = await auditAgent.analyzeLogs(logs);
  
  // Análise é context-aware e respeita princípios de segurança
  console.log(analysis);
}
```

---

## 🎯 Conclusão

### **Context Awareness é OBRIGATÓRIO** ✅

**Benefícios:**
- 🧠 Agentes inteligentes e informados
- 🔒 Respeito automático a princípios de segurança
- 📚 Sempre atualizados com a documentação
- ⚠️ Detecção proativa de violações
- 🎯 Decisões contextualizadas

**Implementação:**
- ✅ Classe base `ContextAwareAgent`
- ✅ `ContextManager` centralizado
- ✅ Validação obrigatória
- ✅ Reload automático
- ✅ Monitoramento contínuo

---

**Próximo Passo:** Implementar `ContextAwareAgent` base class

---

**Última Atualização:** 2025-01-06
**Versão:** v1.0
**Status:** ✅ Especificação Completa - Pronto para Implementação

