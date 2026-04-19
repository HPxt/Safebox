# 📊 Visualização de Relatórios - SafeBox AI

> **Como acessar e entender os relatórios de análise de segurança**

---

## 📁 Estrutura de Diretórios

Os relatórios são organizados automaticamente por data:

```
reports/
├── 2025-01-06/
│   ├── INDEX.md                          # Índice do dia
│   ├── Analise-de-Auditoria-a1b2c3d4.md # Markdown (legível)
│   ├── Analise-de-Auditoria-a1b2c3d4.html # HTML (navegador)
│   ├── Analise-de-Auditoria-a1b2c3d4.json # JSON (programático)
│   ├── Monitoramento-de-Saude-e5f6g7h8.md
│   ├── Monitoramento-de-Saude-e5f6g7h8.html
│   └── ...
├── 2025-01-07/
│   └── ...
└── 2025-01-08/
    └── ...
```

**Organização:**
- 📅 **Pasta por data** (YYYY-MM-DD)
- 📄 **3 formatos** por relatório (Markdown, HTML, JSON)
- 📋 **INDEX.md** com resumo do dia

---

## 🌐 Como Visualizar

### **Opção 1: HTML no Navegador** (Mais Bonito)

1. **Abrir pasta de relatórios:**
   ```
   reports/2025-01-06/
   ```

2. **Duplo clique no arquivo HTML:**
   ```
   Analise-de-Auditoria-a1b2c3d4.html
   ```

3. **Visualizar no navegador:**
   - Interface moderna e colorida
   - Cards por severidade (Crítico, Alto, Médio, Baixo)
   - Métricas visuais
   - Fácil de ler

**Aparência:**
- 🔴 **Críticos** - Borda vermelha
- 🟠 **Altos** - Borda laranja
- 🟡 **Médios** - Borda amarela
- 🟢 **Baixos** - Borda verde

---

### **Opção 2: Markdown no Editor** (Mais Rápido)

1. **Abrir com VS Code, Notepad++, ou qualquer editor:**
   ```
   Analise-de-Auditoria-a1b2c3d4.md
   ```

2. **Ler diretamente:**
   - Texto formatado e legível
   - Emojis para identificação rápida
   - Seções organizadas
   - Fácil de copiar/colar

**Vantagens:**
- ✅ Abre instantaneamente
- ✅ Busca com Ctrl+F
- ✅ Copia fácil para documentos
- ✅ Compatível com qualquer editor

---

### **Opção 3: INDEX.md** (Resumo do Dia)

**Arquivo:** `reports/2025-01-06/INDEX.md`

**Conteúdo:**
```markdown
# 📊 Índice de Relatórios - 2025-01-06

## ✅ Análise de Auditoria - 14:30
- **ID:** `a1b2c3d4`
- **Anomalias:** 3
- **Ações:** 2
- **Arquivos:**
  - [📄 Markdown](Analise-de-Auditoria-a1b2c3d4.md)
  - [🌐 HTML](Analise-de-Auditoria-a1b2c3d4.html)
  - [📊 JSON](Analise-de-Auditoria-a1b2c3d4.json)

---

## ✅ Monitoramento de Saúde - 14:35
...
```

**Vantagens:**
- 📋 Visão geral de todos os relatórios do dia
- 🔗 Links clicáveis para cada formato
- ⚡ Acesso rápido ao que você precisa

---

## 📄 Estrutura de um Relatório

### **Cabeçalho:**
```markdown
# 📊 Relatório de Análise de Segurança

## Análise de Auditoria

**Status:** ✅ Sucesso
**Data/Hora:** domingo, 6 de janeiro de 2025 14:30:45
**ID da Execução:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
**Tempo de Execução:** 2.35s
```

### **Resumo (Tabela de Métricas):**
```markdown
| Métrica | Valor |
|---------|-------|
| **Dados Processados** | 150 registros |
| **Anomalias Detectadas** | 3 |
| **Ações Executadas** | 2 |
| **Findings Críticos** | 1 |
| **Findings Altos** | 2 |
| **Findings Médios** | 0 |
| **Findings Baixos** | 0 |
```

### **Descobertas (Agrupadas por Severidade):**
```markdown
## 🔍 Descobertas (3)

### 🔴 Críticos (1)

#### 1. Múltiplas Tentativas de Login Falhadas

**Categoria:** brute_force
**Descrição:** Detectadas 15 tentativas de login falhadas do IP 192.168.xxx.xxx em 5 minutos.

**Recurso Afetado:** `user@example.com`

**Recomendações:**
- Bloquear temporariamente o IP suspeito
- Notificar o usuário sobre atividade suspeita
- Ativar autenticação de dois fatores (2FA)

<details>
<summary>📋 Ver Evidências</summary>

```json
{
  "log_entries": ["log123", "log124", "log125"],
  "pattern": "15 failed attempts in 5 minutes",
  "ip_anonymized": "192.168.xxx.xxx",
  "timestamp_first": "2025-01-06T14:25:00Z",
  "timestamp_last": "2025-01-06T14:30:00Z"
}
```

</details>

---
```

### **Ações Tomadas:**
```markdown
## ⚡ Ações Tomadas (2)

### ✅ Executadas (1)

1. ✅ **Alerta enviado ao administrador sobre tentativas de brute force**
   - Tipo: Alerta
   - Requer Aprovação: Não
   - Executada em: domingo, 6 de janeiro de 2025 14:31:00
   - Resultado: Email enviado com sucesso

### ⏳ Pendentes de Aprovação (1)

1. ⏳ **Bloquear IP 192.168.xxx.xxx temporariamente (24 horas)**
   - Tipo: Automação
   - Requer Aprovação: Sim
```

### **Rodapé:**
```markdown
---

**Gerado por:** SafeBox Security AI
**Versão:** 1.2
**Agente:** Análise de Auditoria
**Relatório Gerado em:** domingo, 6 de janeiro de 2025 14:32:00
```

---

## 🎨 Código de Cores (HTML)

### **Severidades:**
- 🔴 **Crítico:** Requer ação imediata
- 🟠 **Alto:** Requer atenção prioritária
- 🟡 **Médio:** Revisar quando possível
- 🟢 **Baixo:** Informativo

### **Status:**
- ✅ **Sucesso:** Análise concluída sem erros
- ❌ **Falha:** Erro durante a análise

### **Ações:**
- ✅ **Executada:** Ação concluída automaticamente
- ⏳ **Pendente:** Aguardando sua aprovação

---

## 🔍 Como Interpretar um Relatório

### **1. Verifique o Status no Cabeçalho**
- ✅ Sucesso = Análise completou normalmente
- ❌ Falha = Houve erro, verificar seção de erros

### **2. Olhe as Métricas**
- **Anomalias Detectadas:** Quantos problemas foram encontrados
- **Findings Críticos:** Quantos requerem ação imediata
- **Ações Executadas:** Quantas ações foram tomadas automaticamente

### **3. Leia os Findings por Severidade**
- **Comece pelos Críticos** 🔴 (mais urgente)
- **Depois os Altos** 🟠
- **Médios e Baixos** 🟡🟢 podem esperar

### **4. Revise as Ações**
- **Executadas:** Já foram feitas automaticamente
- **Pendentes:** Precisam da sua aprovação

### **5. Aprove ou Rejeite Ações Pendentes**
- Se concordar: Aprovar via sistema
- Se discordar: Rejeitar e investigar manualmente

---

## 📅 Acesso Rápido aos Relatórios

### **Última Análise:**
```bash
# Windows Explorer
explorer reports\<hoje>\INDEX.md

# Ou navegador
start reports\<hoje>\*.html
```

### **Histórico Completo:**
```bash
# Listar todos os relatórios
dir reports /AD

# Abrir pasta de relatórios
explorer reports
```

### **Buscar por Palavra-chave:**
1. Abrir VS Code na pasta `reports/`
2. `Ctrl + Shift + F` (busca global)
3. Digitar termo (ex: "brute force", "crítico", etc.)

---

## 📊 Relatórios por Agente

### **🔍 Análise de Auditoria**
**O que analisa:**
- Logs de login e autenticação
- Tentativas de brute force
- Acessos suspeitos
- Padrões anômalos

**Frequência:** Semanal (domingos 02:00)

**Como ler:**
- Foque em IPs suspeitos
- Verifique tentativas falhadas
- Valide horários incomuns

---

### **💊 Monitoramento de Saúde**
**O que analisa:**
- Vulnerabilidades conhecidas (CVEs)
- Dependências desatualizadas
- Configurações inseguras
- Métricas de performance

**Frequência:** Semanal (domingos 03:00)

**Como ler:**
- Priorize CVEs críticos
- Atualize dependências vulneráveis
- Ajuste configurações marcadas como inseguras

---

### **📜 Verificação de Conformidade**
**O que analisa:**
- LGPD (consentimento, portabilidade, direito ao esquecimento)
- GDPR (privacy by design, DPO, breach notification)
- ISO 27001 (controles de segurança)
- SOC 2 (confidencialidade, integridade)

**Frequência:** Semanal (domingos 04:00)

**Como ler:**
- Verifique controles não-conformes
- Implemente gaps identificados
- Documente evidências de conformidade

---

### **🛡️ Detecção de Comprometimento**
**O que analisa:**
- Emails expostos em breaches (Have I Been Pwned)
- Senhas fracas
- Reutilização de credenciais
- Credenciais antigas

**Frequência:** Semanal (domingos 05:00)

**Como ler:**
- Notifique usuários com credenciais comprometidas
- Force troca de senhas fracas
- Recomende 2FA para contas de risco

---

## 🛠️ Ferramentas Úteis

### **Para Visualizar HTML:**
- **Chrome/Edge:** Melhor renderização
- **Firefox:** Alternativa
- **Safari:** Para macOS

### **Para Editar Markdown:**
- **VS Code:** Melhor experiência (preview integrado)
- **Obsidian:** Para organização
- **Typora:** Editor visual
- **Notepad++:** Leve e rápido

### **Para Analisar JSON:**
- **VS Code:** Syntax highlighting
- **JSONLint:** Validar online
- **jq:** CLI (linha de comando)

---

## 📧 Notificações Automáticas

### **Email (Opcional):**
Configurar para receber:
- Relatórios semanais por email
- Alertas de findings críticos
- Resumo mensal

### **Configuração:**
```typescript
// Em backend/.env
EMAIL_NOTIFICATIONS=true
EMAIL_TO=seu@email.com
EMAIL_FREQUENCY=weekly
EMAIL_CRITICAL_ONLY=false
```

---

## 🔒 Segurança dos Relatórios

### **Dados Incluídos:**
✅ Metadados sanitizados
✅ IPs anonimizados (192.168.xxx.xxx)
✅ User IDs hasheados (SHA-256)
✅ Timestamps e métricas

### **Dados NÃO Incluídos:**
❌ Senhas
❌ Chaves de criptografia
❌ Dados descriptografados
❌ Informações pessoais não-sanitizadas

### **Permissões Recomendadas:**
```bash
# Apenas você pode ler
chmod 700 reports/  # Linux/Mac
```

---

## 💡 Dicas e Boas Práticas

### **Revisão Semanal:**
1. Segunda-feira de manhã, revise relatórios de domingo
2. Priorize findings críticos e altos
3. Aprove ou rejeite ações pendentes
4. Documente decisões tomadas

### **Arquivo Mensal:**
1. Criar pasta `archive/2025-01/`
2. Mover relatórios do mês anterior
3. Manter apenas últimos 3 meses acessíveis
4. Backup anual em storage externo

### **Alertas Críticos:**
1. Configurar notificação push para findings críticos
2. Revisar imediatamente (< 1 hora)
3. Tomar ação corretiva
4. Documentar resposta

---

## 🆘 Troubleshooting

### **Não encontro os relatórios:**
```bash
# Verificar se o diretório existe
dir reports

# Se não existir, criar
mkdir reports
```

### **HTML não abre no navegador:**
1. Clicar com botão direito no arquivo
2. "Abrir com..." → Escolher navegador
3. Marcar "Sempre usar este programa"

### **Markdown não formata corretamente:**
1. Abrir com VS Code
2. Pressionar `Ctrl + Shift + V` (preview)
3. Ou instalar extensão "Markdown Preview Enhanced"

### **Relatórios muito técnicos:**
1. Focar apenas nas seções "Resumo" e "Recomendações"
2. Ignorar detalhes técnicos em "Evidências"
3. Consultar este guia para interpretação

---

## 📞 Precisa de Ajuda?

**Dúvidas sobre um relatório específico:**
- Copie o ID da execução (ex: `a1b2c3d4`)
- Mostre a seção específica
- Peça explicação ao assistente

**Exemplo:**
```
Explique o finding crítico do relatório a1b2c3d4:
"Múltiplas tentativas de login falhadas"
```

---

**Última Atualização:** 2025-01-06  
**Versão:** 1.2  
**Documentação Completa:** `docs/implementacao-ia/`

---

🎉 **Relatórios prontos para uso! Fáceis de ler e entender.**

