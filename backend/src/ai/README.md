# 🤖 Sistema de IA de Segurança - SafeBox

> **Versão:** 1.2  
> **Status:** Em Desenvolvimento (MVP)  
> **Timeline:** 2-3 semanas

---

## 📋 Visão Geral

Sistema de 4 agentes inteligentes para análise automatizada de segurança do SafeBox, preservando arquitetura zero-knowledge.

### **Agentes Implementados:**

1. **🔍 Audit Agent** - Análise inteligente de logs de auditoria
2. **💊 Health Monitor** - Monitoramento de vulnerabilidades
3. **📜 Compliance Checker** - Validação LGPD/GDPR/ISO27001/SOC2
4. **🛡️ Breach Detector** - Detecção de credenciais comprometidas

---

## 🏗️ Arquitetura

```
ai/
├── types/              # Tipos e interfaces TypeScript
├── sanitizer/          # Sanitização rigorosa de dados
├── llm/                # Cliente Ollama + Prompts
├── agents/             # Agentes inteligentes
│   ├── base/           # Classe base ContextAwareAgent
│   ├── AuditAgent.ts   # [TODO] Análise de logs
│   ├── HealthMonitor.ts    # [TODO]
│   ├── ComplianceChecker.ts  # [TODO]
│   └── BreachDetector.ts     # [TODO]
├── context/            # Gerenciamento de contexto
├── storage/            # Redis + Supabase [TODO]
└── scheduler/          # Agendamento semanal [TODO]
```

---

## 🔒 Princípios de Segurança

### **NUNCA Processar:**
❌ Senhas  
❌ Master passwords  
❌ Chaves de criptografia  
❌ Dados descriptografados  
❌ Chaves privadas  
❌ API keys não-sanitizadas  

### **SEMPRE Fazer:**
✅ Sanitizar dados antes de processar  
✅ Validar com `DataSanitizer.isSafeForAI()`  
✅ Carregar contexto com `ContextManager`  
✅ Auditar todas as ações  
✅ Anonimizar dados pessoais  

---

## 🚀 Quick Start

### **1. Instalar Ollama**

```bash
# Windows: Baixar de https://ollama.com/download/windows
# Linux:
curl -fsSL https://ollama.com/install.sh | sh
```

### **2. Baixar Modelo LLM**

```bash
ollama pull llama3.2:8b
```

### **3. Iniciar Ollama**

```bash
# Terminal 1
ollama serve
```

### **4. Instalar Dependências**

```bash
cd backend
npm install
```

### **5. Configurar Ambiente**

```bash
# backend/.env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:8b
```

### **6. Testar Conexão**

```typescript
import { getOllamaClient } from './ai/llm/OllamaClient';

const client = getOllamaClient();
const isHealthy = await client.healthCheck();
console.log('Ollama:', isHealthy ? '✅ Online' : '❌ Offline');
```

---

## 📝 Uso dos Componentes

### **DataSanitizer**

```typescript
import { DataSanitizer } from './ai/sanitizer/DataSanitizer';

// Sanitizar log de auditoria
const sanitized = DataSanitizer.sanitizeAuditLog(rawLog);

// Validar segurança antes de processar
const { safe, violations } = DataSanitizer.isSafeForAI(data);
if (!safe) {
  throw new Error(`Unsafe data: ${violations.join(', ')}`);
}

// Hash de dados sensíveis
const hash = DataSanitizer.hashData('user@example.com');

// Anonimizar IP
const anonIP = DataSanitizer.anonymizeIP('192.168.1.100');
// Resultado: "192.168.xxx.xxx"
```

### **OllamaClient**

```typescript
import { getOllamaClient } from './ai/llm/OllamaClient';

const client = getOllamaClient();

// Gerar resposta
const response = await client.generate({
  prompt: 'Analise este log de auditoria...',
  systemPrompt: PromptTemplates.getSystemPrompt(AgentType.AUDIT),
  temperature: 0.7,
  maxTokens: 512
});

console.log(response.response);
console.log('Tokens usados:', response.tokensUsed.total);
```

### **ContextAwareAgent**

```typescript
import { ContextAwareAgent } from './ai/agents/base/ContextAwareAgent';
import { AgentType, AgentResult } from './ai/types';

class MyAgent extends ContextAwareAgent {
  constructor() {
    super(AgentType.AUDIT, {
      automationLevel: 3,
      schedule: '0 2 * * 0' // Domingos 02:00
    });
  }

  protected async collectData(): Promise<any> {
    // Coletar logs do Supabase
    return await fetchAuditLogs();
  }

  protected sanitizeData(rawData: any): any {
    return DataSanitizer.sanitizeAuditLog(rawData);
  }

  protected async analyze(sanitizedData: any): Promise<any> {
    const prompt = PromptTemplates.auditLogsAnalysis(sanitizedData);
    const response = await this.llmClient.generate({ prompt });
    return JSON.parse(response.response);
  }

  // ... implementar outros métodos abstratos
}

// Executar agente
const agent = new MyAgent();
const result: AgentResult = await agent.execute();

console.log('Findings:', result.findings);
console.log('Actions:', result.actions);
```

### **ContextManager**

```typescript
import { ContextManager } from './ai/context/ContextManager';
import { AgentType } from './ai/types';

const manager = new ContextManager();

// Carregar contexto para um agente
const context = await manager.loadContext(AgentType.AUDIT);

console.log('Documentos carregados:', context.documents.length);
console.log('Princípios:', context.principles.map(p => p.principle));

// Buscar seção específica
const section = manager.findSection(context, 'zero-knowledge');

// Verificar mudanças e recarregar
const newContext = await manager.reloadIfChanged(AgentType.AUDIT, context);
if (newContext) {
  console.log('Contexto atualizado!');
}
```

---

## 🧪 Testes

### **Estrutura de Testes**

```
ai/__tests__/
├── DataSanitizer.test.ts
├── OllamaClient.test.ts
├── ContextManager.test.ts
├── ContextAwareAgent.test.ts
└── agents/
    ├── AuditAgent.test.ts
    ├── HealthMonitor.test.ts
    ├── ComplianceChecker.test.ts
    └── BreachDetector.test.ts
```

### **Executar Testes**

```bash
# Todos os testes
npm test

# Apenas testes de IA
npm test -- ai/

# Testes com coverage
npm test -- --coverage
```

### **Exemplo de Teste**

```typescript
describe('DataSanitizer', () => {
  it('should reject forbidden fields', () => {
    const data = { password: 'secret123' };
    
    expect(() => {
      DataSanitizer.sanitizeAuditLog(data);
    }).toThrow('SECURITY VIOLATION');
  });

  it('should anonymize IP addresses', () => {
    const ip = '192.168.1.100';
    const anonymized = DataSanitizer.anonymizeIP(ip);
    
    expect(anonymized).toBe('192.168.xxx.xxx');
  });
});
```

---

## 📊 Níveis de Automação

### **Nível 1 - Apenas Alertas**
- Agentes detectam problemas
- Notificam administrador
- Nenhuma ação automática

### **Nível 2 - Sugestões**
- Agentes sugerem ações
- Requer aprovação manual
- Executa se pré-aprovado

### **Nível 3 - Automação Parcial** ⭐ **PADRÃO**
- Ações não-críticas: automáticas
- Ações críticas: requerem aprovação
- Logs detalhados de tudo

### **Nível 4 - Totalmente Autônomo**
- Todas as ações automáticas
- Notificação pós-ação
- Possibilidade de reverter

**Configuração atual:** Nível 3

---

## 🔧 Configuração

### **Variáveis de Ambiente**

```bash
# LLM
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:8b

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=604800  # 7 dias em segundos

# Supabase (já configurado)
SUPABASE_URL=...
SUPABASE_KEY=...

# Agendamento
AI_SCHEDULE_ENABLED=true
AI_SCHEDULE_TIMEZONE=America/Sao_Paulo
```

### **Configuração de Agentes**

```typescript
const config: AgentConfig = {
  enabled: true,
  automationLevel: 3,
  schedule: '0 2 * * 0', // Cron: Domingos 02:00
  maxRetries: 3,
  timeout: 300 // 5 minutos
};
```

---

## 📈 Monitoramento

### **Logs**

Todos os agentes produzem logs estruturados:

```json
{
  "level": "info",
  "agentType": "audit",
  "executionId": "uuid",
  "executionTime": 1250,
  "findingsCount": 3,
  "actionsExecuted": 1,
  "timestamp": "2025-01-06T10:30:00Z"
}
```

### **Auditoria**

Toda execução é auditada:

```typescript
interface AIAuditLog {
  id: string;
  agentType: AgentType;
  action: string;
  dataAccessed: string[];
  sanitized: boolean;
  timestamp: Date;
  executionId: string;
  result: 'success' | 'failure';
}
```

---

## 🚨 Troubleshooting

### **Ollama não conecta**

```bash
# Verificar se está rodando
curl http://localhost:11434/api/tags

# Reiniciar
ollama serve
```

### **Modelo não encontrado**

```bash
# Listar modelos instalados
ollama list

# Baixar modelo
ollama pull llama3.2:8b
```

### **Timeout no LLM**

```typescript
// Aumentar timeout
const client = getOllamaClient({ timeout: 120000 }); // 2 minutos
```

### **Erro de contexto**

```bash
# Verificar documentos
ls docs/implementacao-ia/

# Deve ter: 00-RESUMO-EXECUTIVO.md, 01-PLANO-INTEGRACAO.md, etc.
```

---

## 📚 Documentação

### **Documentos Principais:**
- `docs/implementacao-ia/07-PLANO-ADAPTADO-v1.2.md` - Plano completo
- `docs/implementacao-ia/08-SETUP-OLLAMA.md` - Setup do Ollama
- `docs/implementacao-ia/09-PROGRESSO-MVP.md` - Progresso atual

### **Referências:**
- `docs/implementacao-ia/referencias/openai-snippets.md`
- `docs/implementacao-ia/referencias/jest-testing-snippets.md`

---

## 🤝 Contribuindo

### **Adicionando Novo Agente:**

1. Criar classe estendendo `ContextAwareAgent`
2. Implementar métodos abstratos obrigatórios
3. Adicionar system prompt em `PromptTemplates`
4. Criar testes unitários
5. Documentar no README

### **Adicionando Novo Sanitizer:**

1. Criar método em `DataSanitizer`
2. Adicionar validação de segurança
3. Testar com dados reais (sanitizados)
4. Documentar comportamento

---

## ✅ Checklist de Segurança

Antes de fazer deploy:

- [ ] Todos os dados são sanitizados
- [ ] Validação `isSafeForAI()` em todos os agentes
- [ ] Contexto carregado obrigatoriamente
- [ ] Auditoria implementada
- [ ] Testes de segurança passando (100%)
- [ ] Nenhum campo proibido processado
- [ ] IPs anonimizados
- [ ] Dados pessoais hasheados
- [ ] Ollama isolado (não exposto publicamente)
- [ ] Logs não contêm dados sensíveis

---

## 📞 Suporte

**Dúvidas?**
- 📖 Leia `docs/implementacao-ia/`
- 🐛 Abra issue no GitHub
- 💬 Chat interno da equipe

---

**Última Atualização:** 2025-01-06  
**Versão:** 1.2  
**Maintainer:** Equipe SafeBox  

---

🚀 **SafeBox AI - Segurança Inteligente com Privacidade Total**

