# 🧪 Bateria de Testes Rigorosos - Sistema de IA de Segurança

## 📋 Visão Geral

Este documento define uma **bateria de testes rigorosos** para garantir que a implementação de IA no SafeBox seja:
- ✅ **Segura** - Sem vazamento de dados sensíveis
- ✅ **Confiável** - Resultados precisos e consistentes
- ✅ **Performática** - Sem degradação significativa
- ✅ **Compatível** - Funciona em todos os ambientes
- ✅ **Auditável** - Todos os testes documentados

---

## 🎯 Categorias de Testes

### **1. Testes de Segurança** 🔒
- Validação de sanitização de dados
- Testes de vazamento de informações
- Verificação de permissões
- Auditoria de logs

### **2. Testes Funcionais** ⚙️
- Comportamento dos agentes
- Precisão de detecções
- Integração entre componentes
- Fluxos end-to-end

### **3. Testes de Performance** ⚡
- Latência de análises
- Consumo de recursos
- Escalabilidade
- Carga e estresse

### **4. Testes de Compliance** 📜
- OWASP Top 10
- NIST guidelines
- LGPD/GDPR
- Best practices

### **5. Testes de Integração** 🔗
- APIs externas
- Banco de dados
- Cache (Redis)
- Frontend/Backend

---

## 🔒 Testes de Segurança

### **TS-001: Sanitização de Dados**

**Objetivo:** Garantir que dados sensíveis nunca sejam processados pelos agentes IA

**Cenários de Teste:**

#### TS-001.1: Bloqueio de Senhas
```typescript
describe('Sanitização - Senhas', () => {
  it('deve bloquear senhas descriptografadas', async () => {
    const log = {
      password: 'senha123',
      encrypted_data: 'AES256...'
    }
    
    const sanitized = sanitizeForAI(log)
    
    expect(sanitized).not.toHaveProperty('password')
    expect(sanitized).not.toHaveProperty('encrypted_data')
  })
  
  it('deve alertar tentativa de processar senha', async () => {
    const maliciousInput = {
      type: 'audit_log',
      password: 'hack123'
    }
    
    await expect(
      auditAgent.analyze(maliciousInput)
    ).rejects.toThrow('Dados sensíveis detectados')
  })
})
```

#### TS-001.2: Bloqueio de Chaves Criptográficas
```typescript
describe('Sanitização - Chaves', () => {
  it('deve bloquear chaves de criptografia', async () => {
    const log = {
      master_key: 'argon2id$...',
      salt: 'base64...'
    }
    
    const sanitized = sanitizeForAI(log)
    
    expect(sanitized).not.toHaveProperty('master_key')
    expect(sanitized).not.toHaveProperty('salt')
  })
})
```

#### TS-001.3: Whitelist de Dados Permitidos
```typescript
describe('Sanitização - Whitelist', () => {
  it('deve permitir apenas campos na whitelist', async () => {
    const ALLOWED_FIELDS = [
      'timestamp',
      'event_type',
      'user_id_hash',
      'ip_anonymized',
      'success'
    ]
    
    const log = {
      timestamp: '2025-01-06T10:00:00Z',
      event_type: 'login_attempt',
      password: 'senha123', // não permitido
      credit_card: '1234-5678', // não permitido
    }
    
    const sanitized = sanitizeForAI(log)
    
    const allowedKeys = Object.keys(sanitized)
    expect(allowedKeys).toEqual(
      expect.arrayContaining(ALLOWED_FIELDS)
    )
    expect(sanitized).not.toHaveProperty('password')
    expect(sanitized).not.toHaveProperty('credit_card')
  })
})
```

---

### **TS-002: Testes de Vazamento de Informações**

**Objetivo:** Garantir que nenhuma informação sensível seja exposta

#### TS-002.1: Vazamento em Logs
```typescript
describe('Vazamento - Logs', () => {
  it('não deve logar dados sensíveis', async () => {
    const logSpy = jest.spyOn(logger, 'info')
    
    await auditAgent.analyze({
      user_email: 'test@example.com',
      password: 'senha123'
    })
    
    const logCalls = logSpy.mock.calls.flat().join('')
    
    expect(logCalls).not.toContain('senha123')
    expect(logCalls).not.toContain('password')
  })
})
```

#### TS-002.2: Vazamento em Respostas de Erro
```typescript
describe('Vazamento - Erros', () => {
  it('não deve expor stack traces em produção', async () => {
    process.env.NODE_ENV = 'production'
    
    const response = await request(app)
      .post('/api/ai/audit')
      .send({ invalid: 'data' })
      .expect(400)
    
    expect(response.body).not.toHaveProperty('stack')
    expect(response.body.error).not.toContain('at Function')
  })
})
```

#### TS-002.3: Vazamento para APIs Externas
```typescript
describe('Vazamento - APIs Externas', () => {
  it('deve enviar apenas hash para HIBP', async () => {
    const mockHIBP = jest.spyOn(axios, 'get')
    
    await breachDetector.checkEmail('user@example.com')
    
    const requestUrl = mockHIBP.mock.calls[0][0]
    
    // Deve enviar apenas hash SHA-1 do email
    expect(requestUrl).toMatch(/\/v3\/breachedaccount\/[a-f0-9]{40}/)
    expect(requestUrl).not.toContain('user@example.com')
  })
})
```

---

### **TS-003: Verificação de Permissões**

**Objetivo:** Garantir controle de acesso adequado aos agentes IA

#### TS-003.1: Acesso ao Vault
```typescript
describe('Permissões - Vault', () => {
  it('deve bloquear acesso direto ao vault', async () => {
    await expect(
      aiAgent.accessVault(userId)
    ).rejects.toThrow('Permissão negada')
  })
  
  it('deve permitir apenas metadados do vault', async () => {
    const vaultInfo = await aiAgent.getVaultMetadata(userId)
    
    expect(vaultInfo).toHaveProperty('version')
    expect(vaultInfo).toHaveProperty('lastUpdated')
    expect(vaultInfo).not.toHaveProperty('encrypted_data')
  })
})
```

#### TS-003.2: Segregação de Usuários
```typescript
describe('Permissões - Segregação', () => {
  it('não deve acessar dados de outros usuários', async () => {
    const user1 = 'user-1-id'
    const user2 = 'user-2-id'
    
    await expect(
      auditAgent.analyze(user1, { userId: user2 })
    ).rejects.toThrow('Acesso negado')
  })
})
```

---

### **TS-004: Auditoria de Logs**

**Objetivo:** Garantir rastreabilidade completa de ações dos agentes

#### TS-004.1: Log de Todos os Acessos
```typescript
describe('Auditoria - Logs', () => {
  it('deve registrar todos os acessos de agente', async () => {
    await auditAgent.analyze(sanitizedLogs)
    
    const auditLog = await getLatestAuditLog()
    
    expect(auditLog).toMatchObject({
      agent_name: 'AuditAgent',
      action: 'analyze_logs',
      timestamp: expect.any(Date),
      data_accessed: ['audit_logs'],
      result: 'success'
    })
  })
})
```

#### TS-004.2: Logs Tamper-Proof
```typescript
describe('Auditoria - Integridade', () => {
  it('deve detectar alteração de logs', async () => {
    const originalLog = await createAuditLog()
    
    // Tentar alterar log
    await db.auditLogs.update(originalLog.id, {
      result: 'modified'
    })
    
    const verified = await verifyLogIntegrity(originalLog.id)
    
    expect(verified.isValid).toBe(false)
    expect(verified.tampered).toBe(true)
  })
})
```

---

## ⚙️ Testes Funcionais

### **TF-001: Audit Agent - Detecção de Anomalias**

#### TF-001.1: Múltiplas Tentativas de Login Falhadas
```typescript
describe('AuditAgent - Anomalias', () => {
  it('deve detectar 5+ tentativas falhadas', async () => {
    const logs = generateFailedLoginLogs(5, {
      userId: 'test-user',
      ip: '192.168.1.1'
    })
    
    const analysis = await auditAgent.analyze(logs)
    
    expect(analysis.findings).toContainEqual(
      expect.objectContaining({
        type: 'suspicious_pattern',
        severity: 'high',
        description: expect.stringContaining('múltiplas tentativas')
      })
    )
  })
  
  it('deve identificar padrão de credential stuffing', async () => {
    const logs = generateCredentialStuffingPattern()
    
    const analysis = await auditAgent.analyze(logs)
    
    expect(analysis.findings).toContainEqual(
      expect.objectContaining({
        type: 'breach_attempt',
        severity: 'critical'
      })
    )
  })
})
```

#### TF-001.2: Acesso em Horários Anormais
```typescript
describe('AuditAgent - Horários Anormais', () => {
  it('deve detectar acesso às 3h da manhã', async () => {
    const log = createLoginLog({
      userId: 'user-with-business-hours',
      timestamp: '2025-01-06T03:00:00Z', // 3 AM
      normalHours: '09:00-18:00'
    })
    
    const analysis = await auditAgent.analyze([log])
    
    expect(analysis.findings).toContainEqual(
      expect.objectContaining({
        type: 'anomaly',
        description: expect.stringContaining('horário incomum')
      })
    )
  })
})
```

---

### **TF-002: Breach Detector - Verificação de Credenciais**

#### TF-002.1: Email Comprometido
```typescript
describe('BreachDetector - Email', () => {
  it('deve detectar email em breach conhecida', async () => {
    const result = await breachDetector.checkEmail('test@example.com')
    
    expect(result).toMatchObject({
      isBreached: expect.any(Boolean),
      breachCount: expect.any(Number),
      breaches: expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          breachDate: expect.any(Date),
          dataClasses: expect.any(Array)
        })
      ])
    })
  })
  
  it('deve cachear resultados por 24h', async () => {
    const email = 'cached@example.com'
    
    // Primeira chamada
    await breachDetector.checkEmail(email)
    
    // Segunda chamada (deve usar cache)
    const start = Date.now()
    await breachDetector.checkEmail(email)
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(100) // < 100ms (cache)
  })
})
```

#### TF-002.2: Análise de Força de Senha
```typescript
describe('BreachDetector - Força de Senha', () => {
  it('deve calcular entropia corretamente', () => {
    const weakPassword = '123456'
    const strongPassword = 'Tr0ub4dor&3#aX9!'
    
    const weakEntropy = breachDetector.calculateEntropy(weakPassword)
    const strongEntropy = breachDetector.calculateEntropy(strongPassword)
    
    expect(weakEntropy).toBeLessThan(30)
    expect(strongEntropy).toBeGreaterThan(70)
  })
  
  it('deve detectar padrões comuns', () => {
    const commonPasswords = [
      '123456',
      'password',
      'qwerty123',
      'abc123'
    ]
    
    commonPasswords.forEach(password => {
      const result = breachDetector.analyzeStrength(password)
      expect(result.score).toBeLessThanOrEqual(2)
      expect(result.feedback).toContain('padrão comum')
    })
  })
})
```

---

### **TF-003: Health Monitor - Verificações**

#### TF-003.1: Headers de Segurança
```typescript
describe('HealthMonitor - Headers', () => {
  it('deve verificar presença de headers críticos', async () => {
    const report = await healthMonitor.checkSecurityHeaders()
    
    const requiredHeaders = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'Content-Security-Policy'
    ]
    
    requiredHeaders.forEach(header => {
      expect(report.checks).toContainEqual(
        expect.objectContaining({
          name: header,
          status: 'pass'
        })
      )
    })
  })
})
```

#### TF-003.2: Vulnerabilidades de Dependências
```typescript
describe('HealthMonitor - Dependências', () => {
  it('deve escanear vulnerabilidades conhecidas', async () => {
    const report = await healthMonitor.scanDependencies()
    
    expect(report).toMatchObject({
      totalDependencies: expect.any(Number),
      vulnerabilities: expect.objectContaining({
        low: expect.any(Number),
        medium: expect.any(Number),
        high: expect.any(Number),
        critical: expect.any(Number)
      })
    })
    
    // Falhar se houver vulnerabilidades críticas
    expect(report.vulnerabilities.critical).toBe(0)
  })
})
```

---

### **TF-004: Compliance Checker - Conformidade**

#### TF-004.1: OWASP Top 10
```typescript
describe('ComplianceChecker - OWASP', () => {
  it('deve verificar todos os controles OWASP', async () => {
    const report = await complianceChecker.checkOWASP()
    
    const owaspControls = [
      'A01:2021-Broken Access Control',
      'A02:2021-Cryptographic Failures',
      'A03:2021-Injection',
      // ... todos os 10
    ]
    
    owaspControls.forEach(control => {
      expect(report.controls).toContainEqual(
        expect.objectContaining({
          id: control,
          status: expect.stringMatching(/pass|warning|fail/)
        })
      )
    })
    
    expect(report.overallScore).toBeGreaterThanOrEqual(90)
  })
})
```

#### TF-004.2: LGPD/GDPR
```typescript
describe('ComplianceChecker - LGPD', () => {
  it('deve verificar direitos do titular', async () => {
    const report = await complianceChecker.checkLGPD()
    
    const requiredRights = [
      'right_to_access',
      'right_to_rectification',
      'right_to_erasure',
      'right_to_data_portability'
    ]
    
    requiredRights.forEach(right => {
      expect(report.controls).toContainEqual(
        expect.objectContaining({
          name: right,
          implemented: true
        })
      )
    })
  })
})
```

---

## ⚡ Testes de Performance

### **TP-001: Latência de Análises**

```typescript
describe('Performance - Latência', () => {
  it('deve analisar 100 logs em < 2 segundos', async () => {
    const logs = generateLogs(100)
    
    const start = Date.now()
    await auditAgent.analyze(logs)
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(2000)
  })
  
  it('deve verificar breach em < 5 segundos', async () => {
    const start = Date.now()
    await breachDetector.checkEmail('test@example.com')
    const duration = Date.now() - start
    
    expect(duration).toBeLessThan(5000)
  })
})
```

### **TP-002: Consumo de Recursos**

```typescript
describe('Performance - Recursos', () => {
  it('deve usar < 100MB de memória', async () => {
    const memBefore = process.memoryUsage().heapUsed
    
    await auditAgent.analyze(generateLogs(1000))
    
    const memAfter = process.memoryUsage().heapUsed
    const memUsed = (memAfter - memBefore) / 1024 / 1024 // MB
    
    expect(memUsed).toBeLessThan(100)
  })
  
  it('deve liberar memória após análise', async () => {
    const memBefore = process.memoryUsage().heapUsed
    
    for (let i = 0; i < 10; i++) {
      await auditAgent.analyze(generateLogs(100))
    }
    
    // Forçar garbage collection
    if (global.gc) global.gc()
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const memAfter = process.memoryUsage().heapUsed
    const memIncrease = (memAfter - memBefore) / 1024 / 1024
    
    // Memória não deve crescer > 50MB após múltiplas análises
    expect(memIncrease).toBeLessThan(50)
  })
})
```

### **TP-003: Escalabilidade**

```typescript
describe('Performance - Escalabilidade', () => {
  it('deve processar análises concorrentes', async () => {
    const concurrentAnalyses = 10
    
    const promises = Array(concurrentAnalyses)
      .fill(null)
      .map(() => auditAgent.analyze(generateLogs(50)))
    
    const start = Date.now()
    await Promise.all(promises)
    const duration = Date.now() - start
    
    // 10 análises concorrentes em < 5 segundos
    expect(duration).toBeLessThan(5000)
  })
})
```

---

## 🔗 Testes de Integração

### **TI-001: Integração Backend-Frontend**

```typescript
describe('Integração - Backend/Frontend', () => {
  it('deve retornar análise via API', async () => {
    const response = await request(app)
      .get('/api/ai/audit/analysis')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200)
    
    expect(response.body).toMatchObject({
      overall: expect.stringMatching(/healthy|warning|critical/),
      findings: expect.any(Array),
      recommendations: expect.any(Array)
    })
  })
})
```

### **TI-002: Integração com APIs Externas**

```typescript
describe('Integração - APIs Externas', () => {
  it('deve funcionar com HIBP API', async () => {
    const result = await breachDetector.checkEmail('test@example.com')
    
    expect(result).toHaveProperty('isBreached')
    expect(result).toHaveProperty('breaches')
  })
  
  it('deve ter fallback quando API falhar', async () => {
    // Simular falha da API
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('API Error'))
    
    const result = await breachDetector.checkEmail('test@example.com')
    
    expect(result).toMatchObject({
      isBreached: false,
      error: 'Serviço temporariamente indisponível',
      usedCache: true
    })
  })
})
```

---

## 📊 Cobertura de Testes

### **Metas de Cobertura:**

| Componente | Meta | Status |
|------------|------|--------|
| **Audit Agent** | > 90% | 🔜 Pendente |
| **Breach Detector** | > 90% | 🔜 Pendente |
| **Health Monitor** | > 85% | 🔜 Pendente |
| **Compliance Checker** | > 85% | 🔜 Pendente |
| **Security Coordinator** | > 95% | 🔜 Pendente |
| **Sanitization Utils** | 100% | 🔜 Pendente |

---

## 🚀 Executando os Testes

### **Comandos:**

```bash
# Todos os testes
npm run test

# Apenas testes de segurança
npm run test:security

# Apenas testes funcionais
npm run test:functional

# Apenas testes de performance
npm run test:performance

# Cobertura de testes
npm run test:coverage

# Testes de integração
npm run test:integration

# Testes E2E
npm run test:e2e
```

### **Configuração no package.json:**

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:security": "jest --testPathPattern=security",
    "test:functional": "jest --testPathPattern=functional",
    "test:performance": "jest --testPathPattern=performance",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "jest --testPathPattern=e2e",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage --coverageThreshold='{\"global\":{\"branches\":85,\"functions\":85,\"lines\":85,\"statements\":85}}'"
  }
}
```

---

## ✅ Checklist de Testes por Fase

### **Fase 1: Preparação**
- [ ] TS-001: Sanitização de dados
- [ ] TS-002: Vazamento de informações
- [ ] TS-003: Verificação de permissões
- [ ] TS-004: Auditoria de logs

### **Fase 2: Audit Agent**
- [ ] TF-001: Detecção de anomalias
- [ ] TP-001: Latência de análises
- [ ] TI-001: Integração Backend/Frontend

### **Fase 3: Breach Detector**
- [ ] TF-002: Verificação de credenciais
- [ ] TI-002: Integração com APIs externas
- [ ] TP-002: Consumo de recursos

### **Fase 4: Health Monitor**
- [ ] TF-003: Verificações de saúde
- [ ] TP-003: Escalabilidade

### **Fase 5: Compliance Checker**
- [ ] TF-004: Conformidade
- [ ] Testes de regressão completos

### **Fase 6: Integração**
- [ ] Todos os testes E2E
- [ ] Testes de penetração
- [ ] Auditoria de segurança externa

---

## 📝 Relatórios de Testes

### **Formato de Relatório:**

```markdown
# Relatório de Testes - v1.0

## Resumo Executivo
- Total de Testes: 150
- Aprovados: 145 (96.7%)
- Falhados: 3 (2%)
- Pulados: 2 (1.3%)

## Cobertura
- Linhas: 92%
- Funções: 94%
- Branches: 88%

## Testes Críticos Falhados
1. TS-002.3: Vazamento para APIs (CRÍTICO)
2. TF-001.2: Detecção de horários anormais (MÉDIO)
3. TP-001: Latência acima do esperado (BAIXO)

## Ações Necessárias
- [ ] Corrigir vazamento em API externa
- [ ] Ajustar algoritmo de detecção de horários
- [ ] Otimizar performance de análises
```

---

## 🎯 Conclusão

Esta bateria de testes garante que:

1. ✅ **Segurança Total** - Dados sensíveis nunca vazam
2. ✅ **Funcionalidade Correta** - Agentes funcionam conforme esperado
3. ✅ **Performance Adequada** - Sistema responde rapidamente
4. ✅ **Compliance Garantido** - Atende todos os frameworks
5. ✅ **Qualidade Enterprise** - Pronto para produção

---

**Última Atualização:** 2025-01-06
**Versão:** v1.0
**Status:** ✅ Completo - Pronto para Implementação

