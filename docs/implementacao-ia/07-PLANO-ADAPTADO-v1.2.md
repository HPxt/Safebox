# 📋 Plano Adaptado v1.2 - Sistema de IA de Segurança SafeBox

> **Data:** 2025-01-06  
> **Versão:** v1.2  
> **Status:** Aprovado - Início de Implementação  
> **Baseado em:** Decisões do usuário

---

## ✅ Decisões Confirmadas

### **1. Provider de LLM**
**Escolhido:** 🆓 **Local (Grátis) - LM Studio**

**Modelo em Uso:**
- **GPT OSS 20B** (já instalado no LM Studio) ⭐

**Justificativa:**
- ✅ Modelo já instalado e pronto
- ✅ 20B parâmetros = análise muito precisa
- ✅ Custo zero por requisição
- ✅ Privacidade total (dados não saem do servidor)
- ✅ LM Studio com API compatível OpenAI
- ✅ Ideal para análise de segurança complexa

---

### **2. Nível de Automação**
**Escolhido:** ⚙️ **Nível 3 - Automação Parcial**

**Comportamento:**
- ✅ Ações não-críticas executadas automaticamente
- ✅ Ações críticas requerem aprovação manual
- ✅ Logs detalhados de todas as ações
- ✅ Possibilidade de reverter ações

**Exemplos:**
- **Automático:** Gerar relatórios, enviar alertas, atualizar métricas
- **Manual:** Bloquear IPs, desabilitar contas, modificar configurações de segurança

---

### **3. Priorização de Funcionalidades**
**Escolhida:** 🔒 **Opção A - Segurança First**

**Ordem de Implementação:**
1. **Audit Agent** (Semana 1-2)
2. **Health Monitor** (Semana 2-3)
3. **Compliance Checker** (Semana 3)
4. **Breach Detector** (Semana 3)

**Justificativa:**
- Foco em segurança operacional interna primeiro
- Base sólida antes de features voltadas ao usuário
- Conformidade com princípios de defesa em profundidade

---

### **4. Interface do Usuário**
**Escolhida:** 🤖 **IA Backend-Only (Sem Interface de Usuário)**

**Implementação:**
- ❌ Sem dashboard dedicado de IA
- ❌ Sem chatbot
- ❌ Sem painel de controle de IA
- ✅ Apenas logs de auditoria (já existente)
- ✅ Alertas no sistema de notificações existente
- ✅ Relatórios automatizados por email (opcional)

**Justificativa:**
- IA trabalha exclusivamente nos bastidores
- Foco em segurança operacional
- Menor complexidade de implementação
- Usuário final não precisa interagir com IA

---

### **5. Frequência de Análises**
**Escolhida:** 📅 **Semanal + Automatizado**

**Agendamento:**

| Agente | Frequência | Dia/Hora Sugerida |
|--------|-----------|-------------------|
| **Audit Agent** | 1x/semana | Domingo 02:00 AM |
| **Health Monitor** | 1x/semana | Domingo 03:00 AM |
| **Compliance Checker** | 1x/semana | Domingo 04:00 AM |
| **Breach Detector** | 1x/semana | Domingo 05:00 AM |

**Implementação Técnica:**
- **Node-cron** para agendamento
- Execução assíncrona
- Logs detalhados de cada execução
- Retry automático em caso de falha

---

### **6. Armazenamento de Dados**
**Escolhido:** 🔄 **Híbrido: Redis + Supabase**

**Arquitetura:**

```
┌──────────────────────────────────────────┐
│           Agentes de IA                  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         Redis (Cache)                    │
│  - Resultados temporários                │
│  - Filas de processamento                │
│  - Cache de análises recentes (7 dias)   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│      Supabase PostgreSQL                 │
│  - Histórico completo                    │
│  - Relatórios semanais                   │
│  - Métricas de longo prazo               │
│  - Auditoria permanente                  │
└──────────────────────────────────────────┘
```

**Estratégia:**
1. **Redis:** Cache de 7 dias, limpeza automática
2. **Supabase:** Retenção permanente, backup automático
3. **Sincronização:** Redis → Supabase a cada análise concluída

---

### **7. Budget e Recursos**
**Escolhido:** 🆓 **Grátis/Low-Cost**

**Stack Gratuita:**
- ✅ **Ollama** (LLM local) - Grátis
- ✅ **Redis** (local ou RedisLabs free tier) - Grátis
- ✅ **Supabase** (já em uso) - Grátis
- ✅ **Node-cron** - Grátis
- ✅ **Have I Been Pwned API** - Grátis
- ✅ **npm audit** - Grátis
- ✅ **OWASP ZAP** - Open Source

**Custo Total Mensal:** $0 - $5 (se usar RedisLabs)

---

### **8. Compliance Regulatório**
**Escolhidos:** 📜 **LGPD + GDPR + ISO 27001 + SOC 2**

**Prioridade:** 🟡 **Baixa** (nice to have, não bloqueante)

**Implementação:**

| Framework | Checklist Principal |
|-----------|---------------------|
| **LGPD** | Consentimento, Portabilidade, Direito ao Esquecimento |
| **GDPR** | Privacy by Design, Data Protection Officer, Breach Notification |
| **ISO 27001** | Controles de Segurança, Gestão de Riscos, Auditoria |
| **SOC 2** | Confidencialidade, Integridade, Disponibilidade |

**Agente Responsável:** Compliance Checker (prioridade 3)

---

### **9. Ambiente de Deploy**
**Escolhido:** 🌐 **Híbrido: Backend Supabase + IA Local**

**Arquitetura de Deploy:**

```
┌─────────────────────────────────────────────┐
│          Frontend (Vercel)                  │
│  - React + TypeScript                       │
│  - Nenhuma integração direta com IA         │
└─────────────┬───────────────────────────────┘
              │ HTTPS
              ▼
┌─────────────────────────────────────────────┐
│       Backend API (Supabase Edge)           │
│  - Node.js + Express                        │
│  - Rotas de autenticação e vault            │
│  - APIs de logs de auditoria                │
└─────────────┬───────────────────────────────┘
              │ Internal Network
              ▼
┌─────────────────────────────────────────────┐
│     IA Service (Local/Self-Hosted)          │
│  - Ollama LLM                               │
│  - Agentes de Segurança                     │
│  - Processamento de logs sanitizados        │
│  - Redis Cache                              │
└─────────────┴───────────────────────────────┘
              ▲
              │ Read/Write
              ▼
┌─────────────────────────────────────────────┐
│       Supabase PostgreSQL                   │
│  - Histórico de análises                    │
│  - Métricas de segurança                    │
│  - Logs de auditoria                        │
└─────────────────────────────────────────────┘
```

**Isolamento de Segurança:**
- IA não tem acesso direto ao banco de dados principal
- Apenas logs sanitizados são processados
- Comunicação via API interna autenticada

---

### **10. Timeline**
**Escolhida:** ⚡ **MVP Rápido (2-3 semanas)**

**Cronograma Detalhado:**

#### **Semana 1: Setup + Audit Agent**
- **Dias 1-2:** Configurar Ollama, Redis, estrutura base
- **Dias 3-5:** Implementar Audit Agent completo
- **Dias 6-7:** Testes de segurança do Audit Agent

#### **Semana 2: Health Monitor + Compliance**
- **Dias 1-3:** Implementar Health Monitor
- **Dias 4-5:** Implementar Compliance Checker
- **Dias 6-7:** Integração Redis + Supabase

#### **Semana 3: Breach Detector + Polimento**
- **Dias 1-3:** Implementar Breach Detector
- **Dias 4-5:** Agendamento semanal (node-cron)
- **Dias 6-7:** Testes completos, documentação, deploy

---

## 🏗️ Arquitetura Técnica Adaptada

### **Stack Tecnológica Final**

```yaml
LLM:
  - LM Studio (GPT OSS 20B)
  - API compatível OpenAI
  - Execução local

Backend:
  - Node.js + TypeScript
  - Express.js
  - Supabase SDK

Cache:
  - Redis (local ou RedisLabs)
  - TTL: 7 dias

Database:
  - Supabase PostgreSQL
  - Tabelas: ai_audit_logs, ai_security_reports

Scheduling:
  - node-cron
  - Agendamento semanal

Testing:
  - Jest
  - Supertest

Security:
  - OWASP ZAP (staging only)
  - npm audit
  - Have I Been Pwned API
```

---

## 📁 Estrutura de Diretórios

```
backend/
├── src/
│   ├── ai/                          # 🆕 Nova pasta de IA
│   │   ├── agents/                  # Agentes inteligentes
│   │   │   ├── base/
│   │   │   │   ├── ContextAwareAgent.ts
│   │   │   │   └── AgentInterface.ts
│   │   │   ├── AuditAgent.ts        # Prioridade 1
│   │   │   ├── HealthMonitor.ts     # Prioridade 2
│   │   │   ├── ComplianceChecker.ts # Prioridade 3
│   │   │   └── BreachDetector.ts    # Prioridade 4
│   │   ├── context/                 # Context loading
│   │   │   ├── ContextManager.ts
│   │   │   └── DocumentLoader.ts
│   │   ├── llm/                     # LLM integration
│   │   │   ├── OllamaClient.ts
│   │   │   └── PromptTemplates.ts
│   │   ├── storage/                 # Redis + Supabase
│   │   │   ├── RedisCache.ts
│   │   │   └── SupabaseStorage.ts
│   │   ├── scheduler/               # Agendamento
│   │   │   ├── WeeklyScheduler.ts
│   │   │   └── JobQueue.ts
│   │   └── sanitizer/               # Sanitização
│   │       └── DataSanitizer.ts
│   ├── routes/
│   │   └── ai.routes.ts             # 🆕 Rotas de IA (internas)
│   └── ... (estrutura existente)
```

---

## 🔒 Garantias de Segurança Reforçadas

### **Princípios Implementados:**

1. **Zero-Knowledge Preservado**
   ```typescript
   // ❌ NUNCA processado por IA
   const forbidden = [
     'password',
     'master_password',
     'encryption_key',
     'decrypted_data'
   ];
   ```

2. **Sanitização Obrigatória**
   ```typescript
   class DataSanitizer {
     sanitizeAuditLog(log: AuditLog): SanitizedLog {
       return {
         event_type: log.event_type,
         timestamp: log.timestamp,
         user_id_hash: sha256(log.user_id), // Hash, não ID real
         ip_anonymized: this.anonymizeIP(log.ip),
         success: log.success
         // Sem dados sensíveis
       };
     }
   }
   ```

3. **Isolamento de Rede**
   - IA não tem acesso à internet
   - Apenas APIs whitelistadas (HIBP)
   - Firewall local

4. **Auditoria Completa**
   ```typescript
   // Todo acesso de IA é logado
   await auditLog.create({
     agent: 'AuditAgent',
     action: 'analyze_logs',
     data_accessed: ['audit_logs'],
     timestamp: new Date(),
     result: 'no_anomalies_detected'
   });
   ```

---

## 🧪 Bateria de Testes Adaptada

### **Prioridades de Teste:**

#### **1. Testes de Segurança (Crítico)**
- ✅ Validar que senhas NUNCA são processadas
- ✅ Verificar sanitização de dados
- ✅ Testar isolamento de rede
- ✅ Validar auditoria completa

#### **2. Testes Funcionais (Alto)**
- ✅ Audit Agent detecta anomalias
- ✅ Health Monitor identifica vulnerabilidades
- ✅ Agendamento semanal funciona
- ✅ Redis + Supabase sincronizam

#### **3. Testes de Performance (Médio)**
- ✅ Análise completa < 5 minutos
- ✅ Impacto no backend < 10% CPU
- ✅ Ollama responde em < 30 segundos

---

## 📊 Métricas de Sucesso do MVP

### **Semana 1 (Audit Agent):**
- [ ] Ollama configurado e funcional
- [ ] Audit Agent analisa logs corretamente
- [ ] Sanitização validada
- [ ] Testes de segurança passando

### **Semana 2 (Health + Compliance):**
- [ ] Health Monitor detecta vulnerabilidades
- [ ] Compliance Checker valida LGPD/GDPR
- [ ] Redis + Supabase integrados
- [ ] Cache funcional

### **Semana 3 (Breach + Deploy):**
- [ ] Breach Detector integrado com HIBP
- [ ] Agendamento semanal ativo
- [ ] 4 agentes funcionando
- [ ] Deploy híbrido completo
- [ ] Documentação atualizada

---

## 🚀 Próximos Passos Imediatos

### **Agora (Hoje):**
1. ✅ Criar este documento v1.2
2. 🔜 Instalar Ollama localmente
3. 🔜 Configurar Redis
4. 🔜 Criar estrutura base de diretórios

### **Amanhã:**
1. Implementar `ContextAwareAgent` (classe base)
2. Criar `OllamaClient`
3. Implementar `DataSanitizer`

### **Esta Semana:**
1. Implementar Audit Agent completo
2. Criar testes de segurança
3. Validar sanitização

---

## 📝 Decisões Documentadas

| ID | Decisão | Escolha | Justificativa |
|----|---------|---------|---------------|
| 1 | LLM Provider | Ollama (Local) | Custo zero, privacidade total |
| 2 | Automação | Nível 3 (Parcial) | Balanço segurança/eficiência |
| 3 | Priorização | Segurança First | Foco operacional interno |
| 4 | Interface | Backend-only | Sem contato com usuário |
| 5 | Frequência | Semanal | Leve, suficiente |
| 6 | Storage | Redis + Supabase | Híbrido otimizado |
| 7 | Budget | Grátis | Stack 100% open source |
| 8 | Compliance | LGPD+GDPR+ISO+SOC2 | Baixa prioridade |
| 9 | Deploy | Híbrido | Backend cloud, IA local |
| 10 | Timeline | MVP 2-3 semanas | Entrega rápida |

---

## ✅ Checklist de Implementação

### **Fase 1: Setup (Dias 1-2)**
- [ ] Instalar Ollama
- [ ] Baixar modelo Llama 3.2 8B
- [ ] Configurar Redis (local ou RedisLabs)
- [ ] Criar estrutura de diretórios `backend/src/ai/`
- [ ] Instalar dependências npm

### **Fase 2: Base (Dias 3-4)**
- [ ] Implementar `ContextAwareAgent`
- [ ] Implementar `OllamaClient`
- [ ] Implementar `DataSanitizer`
- [ ] Criar testes base

### **Fase 3: Audit Agent (Dias 5-7)**
- [ ] Implementar `AuditAgent`
- [ ] Integrar com logs existentes
- [ ] Criar prompts de análise
- [ ] Testes de segurança

### **Fase 4: Storage (Dias 8-10)**
- [ ] Implementar `RedisCache`
- [ ] Implementar `SupabaseStorage`
- [ ] Criar tabelas no Supabase
- [ ] Testar sincronização

### **Fase 5: Health + Compliance (Dias 11-14)**
- [ ] Implementar `HealthMonitor`
- [ ] Implementar `ComplianceChecker`
- [ ] Integrar npm audit
- [ ] Validação LGPD/GDPR

### **Fase 6: Breach + Schedule (Dias 15-18)**
- [ ] Implementar `BreachDetector`
- [ ] Integrar HIBP API
- [ ] Implementar `WeeklyScheduler`
- [ ] Configurar node-cron

### **Fase 7: Polimento (Dias 19-21)**
- [ ] Testes completos E2E
- [ ] Documentação técnica
- [ ] Deploy híbrido
- [ ] Validação final

---

## 🎯 Definição de "Pronto" (MVP)

O MVP estará completo quando:

1. ✅ **4 agentes funcionais:**
   - Audit Agent analisa logs semanalmente
   - Health Monitor detecta vulnerabilidades
   - Compliance Checker valida LGPD/GDPR/ISO/SOC2
   - Breach Detector verifica credenciais

2. ✅ **Automação semanal:**
   - Agentes executam todo domingo automaticamente
   - Logs detalhados de cada execução
   - Alertas em caso de problemas críticos

3. ✅ **Segurança validada:**
   - Testes de segurança passando 100%
   - Sanitização validada
   - Zero-knowledge preservado
   - Auditoria completa

4. ✅ **Deploy híbrido:**
   - Backend no Supabase
   - IA local (Ollama)
   - Redis funcionando
   - Sincronização automática

5. ✅ **Documentação:**
   - Setup completo documentado
   - APIs documentadas
   - Troubleshooting guide

---

## 📞 Próxima Ação

**Status:** ✅ v1.2 Aprovado  
**Próximo Todo:** Instalar Ollama e configurar ambiente  
**Responsável:** Assistente + Usuário  
**Prazo:** Hoje

---

**Fim do Plano v1.2** 🚀

**Vamos começar a implementação!**

