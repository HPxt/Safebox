# 🚀 Fase 7 - Redis + Supabase + StorageService

**Data de Planejamento:** 06/10/2025  
**Prioridade:** Alta  
**Duração Estimada:** 4-6 horas  
**Dependências:** ✅ AuditAgent completo  

---

## 🎯 Objetivos da Fase 7

1. ✅ **Configurar Redis** para cache de curto prazo (7 dias)
2. ✅ **Configurar Supabase** para persistência permanente
3. ✅ **Implementar StorageService** (camada unificada)
4. ✅ **Integrar com AuditAgent** (salvar resultados automaticamente)

---

## 📋 Checklist de Implementação

### **Etapa 1: Setup Redis (1 hora)**

#### **1.1 Instalação**
```bash
# Opção 1: Docker (recomendado)
docker run -d --name redis-safebox -p 6379:6379 redis:latest

# Opção 2: Windows (via MSI)
# Download: https://github.com/microsoftarchive/redis/releases

# Opção 3: WSL
sudo apt-get install redis-server
sudo service redis-server start
```

#### **1.2 Testar Conexão**
```bash
redis-cli ping
# Deve retornar: PONG
```

#### **1.3 Configurar .env**
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=604800  # 7 dias
REDIS_PREFIX=safebox:ai:
```

#### **1.4 Criar RedisCache.ts**
**Arquivo:** `backend/src/ai/storage/RedisCache.ts`

**Funcionalidades:**
- [ ] Conexão com Redis
- [ ] Método `set(key, value, ttl)`
- [ ] Método `get(key)`
- [ ] Método `delete(key)`
- [ ] Método `exists(key)`
- [ ] Método `setAnalysis(agentType, executionId, result)`
- [ ] Método `getAnalysis(agentType, executionId)`
- [ ] Método `getRecentAnalyses(agentType, limit)`
- [ ] Health check
- [ ] Limpeza automática (TTL)

**Dependências:**
```bash
npm install ioredis @types/ioredis
```

---

### **Etapa 2: Setup Supabase (2 horas)**

#### **2.1 Criar Tabelas SQL**
**Arquivo:** `backend/migrations/004_ai_storage.sql`

```sql
-- Tabela de análises de IA
CREATE TABLE ai_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_type VARCHAR(50) NOT NULL,
  execution_id VARCHAR(100) UNIQUE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL, -- completed, failed, partial
  findings_count INT NOT NULL DEFAULT 0,
  critical_count INT NOT NULL DEFAULT 0,
  high_count INT NOT NULL DEFAULT 0,
  medium_count INT NOT NULL DEFAULT 0,
  low_count INT NOT NULL DEFAULT 0,
  actions_count INT NOT NULL DEFAULT 0,
  execution_time_ms INT NOT NULL,
  logs_analyzed INT,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de findings
CREATE TABLE ai_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_log_id UUID REFERENCES ai_audit_logs(id) ON DELETE CASCADE,
  finding_id VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  affected_resources TEXT[],
  recommendations TEXT[],
  evidence JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de ações
CREATE TABLE ai_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_log_id UUID REFERENCES ai_audit_logs(id) ON DELETE CASCADE,
  action_id VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  automated BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  priority VARCHAR(20) NOT NULL,
  estimated_impact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);

-- Tabela de relatórios
CREATE TABLE ai_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audit_log_id UUID REFERENCES ai_audit_logs(id) ON DELETE CASCADE,
  format VARCHAR(20) NOT NULL, -- markdown, html, json, pdf
  file_path TEXT NOT NULL,
  file_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_ai_audit_logs_agent_type ON ai_audit_logs(agent_type);
CREATE INDEX idx_ai_audit_logs_timestamp ON ai_audit_logs(timestamp DESC);
CREATE INDEX idx_ai_audit_logs_status ON ai_audit_logs(status);
CREATE INDEX idx_ai_findings_severity ON ai_findings(severity);
CREATE INDEX idx_ai_findings_audit_log ON ai_findings(audit_log_id);
CREATE INDEX idx_ai_actions_audit_log ON ai_actions(audit_log_id);
CREATE INDEX idx_ai_actions_executed ON ai_actions(executed);

-- RLS Policies (Row Level Security)
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas service role pode acessar
CREATE POLICY "Service role only" ON ai_audit_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON ai_findings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON ai_actions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON ai_reports
  FOR ALL USING (auth.role() = 'service_role');
```

#### **2.2 Aplicar Migration**
```bash
# Via Supabase CLI
supabase migration up

# Ou via SQL Editor no Dashboard
# Copiar e colar o SQL acima
```

#### **2.3 Criar SupabaseStorage.ts**
**Arquivo:** `backend/src/ai/storage/SupabaseStorage.ts`

**Funcionalidades:**
- [ ] Conexão com Supabase (service role)
- [ ] Método `saveAnalysis(result)`
- [ ] Método `getAnalysis(executionId)`
- [ ] Método `getRecentAnalyses(agentType, limit)`
- [ ] Método `getAnalysesByDateRange(start, end)`
- [ ] Método `getFindingsBySeverity(severity)`
- [ ] Método `getUnexecutedActions()`
- [ ] Método `markActionExecuted(actionId)`
- [ ] Método `generateReport(period)`
- [ ] Health check

---

### **Etapa 3: StorageService Unificado (1 hora)**

#### **3.1 Criar StorageService.ts**
**Arquivo:** `backend/src/ai/storage/StorageService.ts`

**Arquitetura:**
```
┌─────────────────────────────────────┐
│         AuditAgent                  │
│   (gera AgentResult)                │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│      StorageService                 │
│   (camada unificada)                │
└─────┬───────────────────────┬───────┘
      │                       │
      ▼                       ▼
┌─────────────┐         ┌─────────────┐
│ RedisCache  │         │  Supabase   │
│  (7 dias)   │         │ (permanente)│
└─────────────┘         └─────────────┘
```

**Funcionalidades:**
- [ ] Método `save(result)`:
  1. Salvar no Redis (cache)
  2. Salvar no Supabase (persistência)
  3. Retornar confirmação
- [ ] Método `get(executionId)`:
  1. Tentar Redis primeiro (cache-first)
  2. Se não encontrar, buscar no Supabase
  3. Se encontrar no Supabase, popular Redis
- [ ] Método `getRecent(agentType, limit)`
- [ ] Método `getStats(period)`
- [ ] Método `cleanup()` - Limpar cache expirado

**Padrão de Design:** Repository Pattern

---

### **Etapa 4: Integração com AuditAgent (30 min)**

#### **4.1 Modificar AuditAgent.ts**

**Antes:**
```typescript
// 9. Gerar relatórios
await this.reportGenerator.generateReport(result, AgentType.AUDIT);

// 10. Registrar auditoria
await this.logAudit(result);
```

**Depois:**
```typescript
// 9. Gerar relatórios
await this.reportGenerator.generateReport(result, AgentType.AUDIT);

// 10. Salvar no storage (Redis + Supabase)
await this.storageService.save(result);

// 11. Registrar auditoria
await this.logAudit(result);
```

#### **4.2 Injetar Dependência**
```typescript
export class AuditAgent extends ContextAwareAgent {
  private reportGenerator: ReportGenerator;
  private storageService: StorageService; // Novo

  constructor(config?: Partial<AgentConfig>) {
    super(AgentType.AUDIT, config);
    this.reportGenerator = new ReportGenerator();
    this.storageService = new StorageService(); // Novo
  }
}
```

---

### **Etapa 5: Testes (1 hora)**

#### **5.1 Teste de Redis**
**Arquivo:** `backend/src/ai/storage/__tests__/redis-cache.test.ts`

```typescript
describe('RedisCache', () => {
  it('should connect to Redis', async () => {
    const cache = new RedisCache();
    const health = await cache.healthCheck();
    expect(health).toBe(true);
  });

  it('should set and get values', async () => {
    const cache = new RedisCache();
    await cache.set('test-key', { data: 'test' }, 60);
    const value = await cache.get('test-key');
    expect(value.data).toBe('test');
  });

  it('should expire after TTL', async () => {
    const cache = new RedisCache();
    await cache.set('expire-key', { data: 'test' }, 1); // 1 segundo
    await new Promise(resolve => setTimeout(resolve, 2000));
    const value = await cache.get('expire-key');
    expect(value).toBeNull();
  });
});
```

#### **5.2 Teste de Supabase**
**Arquivo:** `backend/src/ai/storage/__tests__/supabase-storage.test.ts`

```typescript
describe('SupabaseStorage', () => {
  it('should save analysis', async () => {
    const storage = new SupabaseStorage();
    const result = createMockAgentResult();
    const saved = await storage.saveAnalysis(result);
    expect(saved).toBe(true);
  });

  it('should retrieve analysis', async () => {
    const storage = new SupabaseStorage();
    const analysis = await storage.getAnalysis('test-execution-id');
    expect(analysis).toBeDefined();
    expect(analysis.findings).toBeArray();
  });
});
```

#### **5.3 Teste de Integração Completa**
```bash
npm run test:audit

# Verificar:
# 1. Relatórios gerados ✅
# 2. Email enviado ✅
# 3. Salvo no Redis ✅
# 4. Salvo no Supabase ✅
```

---

## 📦 Dependências Necessárias

```json
{
  "dependencies": {
    "ioredis": "^5.6.1",
    "@supabase/supabase-js": "^2.38.4"
  },
  "devDependencies": {
    "@types/ioredis": "^5.0.0"
  }
}
```

**Instalar:**
```bash
cd backend
npm install ioredis @types/ioredis
```

---

## 🔍 Queries de Monitoramento

### **Verificar últimas análises:**
```sql
SELECT 
  agent_type,
  execution_id,
  status,
  findings_count,
  critical_count,
  timestamp
FROM ai_audit_logs
ORDER BY timestamp DESC
LIMIT 10;
```

### **Findings por severidade:**
```sql
SELECT 
  severity,
  COUNT(*) as total,
  COUNT(DISTINCT audit_log_id) as analysis_count
FROM ai_findings
GROUP BY severity
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;
```

### **Ações pendentes:**
```sql
SELECT 
  a.type,
  a.description,
  a.priority,
  al.agent_type,
  al.timestamp
FROM ai_actions a
JOIN ai_audit_logs al ON a.audit_log_id = al.id
WHERE a.executed = FALSE
  AND a.requires_approval = TRUE
ORDER BY 
  CASE a.priority
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END,
  al.timestamp DESC;
```

---

## ⚡ Performance Esperada

| Operação | Tempo Esperado |
|----------|----------------|
| **Salvar no Redis** | < 10ms |
| **Salvar no Supabase** | < 100ms |
| **Buscar do Redis** | < 5ms |
| **Buscar do Supabase** | < 50ms |
| **Análise completa** | 2-3 min |

---

## 🐛 Troubleshooting

### **Redis não conecta:**
```bash
# Verificar se está rodando
redis-cli ping

# Verificar logs
docker logs redis-safebox

# Reiniciar
docker restart redis-safebox
```

### **Supabase retorna erro:**
```typescript
// Verificar service role key
console.log(process.env.SUPABASE_SERVICE_ROLE_KEY);

// Testar conexão
const { data, error } = await supabase
  .from('ai_audit_logs')
  .select('count');

console.log({ data, error });
```

---

## 📊 Estrutura Final

```
backend/src/ai/
├── storage/
│   ├── RedisCache.ts           🆕 (1 hora)
│   ├── SupabaseStorage.ts      🆕 (2 horas)
│   ├── StorageService.ts       🆕 (1 hora)
│   └── __tests__/
│       ├── redis-cache.test.ts 🆕
│       └── supabase-storage.test.ts 🆕
└── agents/
    └── AuditAgent.ts           📝 (integração)
```

---

## ✅ Definition of Done

A Fase 7 estará completa quando:

- [ ] Redis instalado e funcional
- [ ] Tabelas criadas no Supabase
- [ ] `RedisCache.ts` implementado e testado
- [ ] `SupabaseStorage.ts` implementado e testado
- [ ] `StorageService.ts` unificado criado
- [ ] AuditAgent integrado com storage
- [ ] Teste completo passando:
  - Análise executada ✅
  - Salvo no Redis ✅
  - Salvo no Supabase ✅
  - Email enviado ✅
- [ ] Queries de monitoramento testadas
- [ ] Documentação atualizada

---

## 🎯 Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| **Cache Hit Rate** | > 80% |
| **Write Latency** | < 100ms |
| **Read Latency** | < 50ms |
| **Storage Reliability** | > 99.9% |
| **TTL Compliance** | 100% |

---

## 🚀 Comandos para Próxima Sessão

```bash
# 1. Iniciar Redis
docker start redis-safebox

# 2. Testar Redis
redis-cli ping

# 3. Navegar para backend
cd backend

# 4. Instalar dependências
npm install ioredis @types/ioredis

# 5. Criar arquivos
mkdir -p src/ai/storage/__tests__

# 6. Iniciar desenvolvimento
code src/ai/storage/RedisCache.ts
```

---

**Estimativa total:** 4-6 horas  
**Dificuldade:** Média  
**Bloqueadores:** Nenhum  
**Prioridade:** Alta  

🎯 **Objetivo:** Persistência completa e cache eficiente para todas as análises de IA

