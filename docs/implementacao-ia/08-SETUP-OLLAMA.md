# 🤖 Setup do Ollama - LLM Local Gratuito

> **Guia completo para configurar Ollama no ambiente de desenvolvimento**

---

## 📋 O Que é Ollama?

**Ollama** é uma ferramenta open-source para executar Large Language Models (LLMs) localmente, de forma gratuita e privada.

**Vantagens:**
- ✅ 100% gratuito
- ✅ Privacidade total (dados não saem da máquina)
- ✅ Sem necessidade de API keys
- ✅ Offline-first
- ✅ Baixo consumo de recursos (com modelos otimizados)

---

## 💻 Instalação

### **Windows**

1. **Download:**
   - Acesse: https://ollama.com/download/windows
   - Baixe o instalador `OllamaSetup.exe`

2. **Instalar:**
   ```powershell
   # Execute o instalador baixado
   .\OllamaSetup.exe
   ```

3. **Verificar Instalação:**
   ```powershell
   ollama --version
   # Deve retornar: ollama version X.X.X
   ```

### **Linux**

```bash
# Instalação via script oficial
curl -fsSL https://ollama.com/install.sh | sh

# Verificar
ollama --version
```

### **macOS**

```bash
# Download via Homebrew
brew install ollama

# Ou download manual
# https://ollama.com/download/mac
```

---

## 🧠 Modelos Recomendados para SafeBox

### **Opção 1: Llama 3.2 8B (Recomendado)**

**Características:**
- Tamanho: 8B parâmetros (~4.7GB)
- Memória RAM: 8GB mínimo
- Precisão: Alta
- Velocidade: Boa

**Instalação:**
```bash
ollama pull llama3.2:8b
```

**Por que escolher:**
- ✅ Balanceado entre precisão e performance
- ✅ Excelente para análise de logs
- ✅ Bom raciocínio lógico
- ✅ Suporte a português

---

### **Opção 2: Llama 3.2 3B (Leve)**

**Características:**
- Tamanho: 3B parâmetros (~2GB)
- Memória RAM: 4GB mínimo
- Precisão: Boa
- Velocidade: Muito rápida

**Instalação:**
```bash
ollama pull llama3.2:3b
```

**Por que escolher:**
- ✅ Roda em máquinas mais modestas
- ✅ Resposta muito rápida
- ✅ Suficiente para tarefas estruturadas
- ❌ Menos preciso em análises complexas

---

### **Opção 3: Mistral 7B**

**Características:**
- Tamanho: 7B parâmetros (~4.1GB)
- Memória RAM: 8GB mínimo
- Precisão: Muito alta
- Velocidade: Boa

**Instalação:**
```bash
ollama pull mistral:7b
```

**Por que escolher:**
- ✅ Excelente raciocínio
- ✅ Ótimo para análise de segurança
- ✅ Suporte multilíngue
- ❌ Ligeiramente mais lento

---

### **Opção 4: Phi-3 Mini (Mais Leve)**

**Características:**
- Tamanho: 3.8B parâmetros (~2.3GB)
- Memória RAM: 4GB mínimo
- Precisão: Boa
- Velocidade: Muito rápida

**Instalação:**
```bash
ollama pull phi3:mini
```

**Por que escolher:**
- ✅ Menor consumo de recursos
- ✅ Criado pela Microsoft
- ✅ Otimizado para tarefas específicas
- ❌ Menos versátil

---

## 🎯 Recomendação Final para SafeBox

**Use:** `llama3.2:8b`

**Justificativa:**
- Balanceado para todas as tarefas (Audit, Health, Compliance, Breach)
- Boa precisão em português
- Roda bem em máquinas modernas (8GB RAM)
- Amplamente testado pela comunidade

---

## 🚀 Testando Ollama

### **1. Iniciar Servidor Ollama**

```powershell
# Windows PowerShell
ollama serve
```

O servidor iniciará na porta `11434`.

### **2. Testar Modelo**

```powershell
# Testar diretamente no terminal
ollama run llama3.2:8b "Analise este log de auditoria: login failed from IP 192.168.1.100"
```

**Resposta esperada:**
```
O log indica uma tentativa de login falhada originada do endereço IP 192.168.1.100...
```

### **3. Testar API REST**

```powershell
# Testar via curl
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:8b",
  "prompt": "Explique o que é zero-knowledge encryption",
  "stream": false
}'
```

---

## 🔌 Integração com Node.js

### **Instalar Dependências**

```bash
cd backend
npm install ollama
```

### **Código de Teste**

Crie `backend/test-ollama.js`:

```javascript
const { Ollama } = require('ollama');

const ollama = new Ollama({ host: 'http://localhost:11434' });

async function testOllama() {
  console.log('🧪 Testando Ollama...\n');

  const response = await ollama.generate({
    model: 'llama3.2:8b',
    prompt: 'Liste 3 principais ameaças de segurança em APIs REST',
    stream: false
  });

  console.log('✅ Resposta do Ollama:');
  console.log(response.response);
  console.log('\n📊 Estatísticas:');
  console.log(`- Tokens gerados: ${response.eval_count}`);
  console.log(`- Tempo: ${response.eval_duration / 1e9} segundos`);
}

testOllama().catch(console.error);
```

**Executar:**
```bash
node test-ollama.js
```

---

## ⚙️ Configuração Avançada

### **Ajustar Performance**

Edite `~/.ollama/config.json`:

```json
{
  "models": {
    "llama3.2:8b": {
      "context_length": 4096,
      "num_gpu": 0,
      "num_thread": 4,
      "num_predict": 512
    }
  }
}
```

**Parâmetros:**
- `context_length`: Tamanho do contexto (tokens)
- `num_gpu`: GPUs para usar (0 = CPU only)
- `num_thread`: Threads da CPU
- `num_predict`: Máximo de tokens na resposta

---

## 🐛 Troubleshooting

### **Problema: "Connection refused"**

**Solução:**
```bash
# Iniciar servidor Ollama
ollama serve

# Em outro terminal, testar
ollama list
```

### **Problema: Modelo muito lento**

**Soluções:**
1. Use modelo menor (`llama3.2:3b`)
2. Reduza `context_length` para 2048
3. Reduza `num_predict` para 256
4. Aumente `num_thread` para usar mais CPU

### **Problema: Out of memory**

**Soluções:**
1. Use modelo menor (`phi3:mini`)
2. Feche outros aplicativos
3. Reinicie o servidor Ollama

### **Problema: Modelo não encontrado**

**Solução:**
```bash
# Listar modelos instalados
ollama list

# Se não estiver, baixar
ollama pull llama3.2:8b
```

---

## 📊 Comparação de Modelos

| Modelo | Tamanho | RAM Mín. | Velocidade | Precisão | Recomendado |
|--------|---------|----------|------------|----------|-------------|
| **llama3.2:8b** | 4.7GB | 8GB | ⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **SIM** |
| llama3.2:3b | 2GB | 4GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Para máquinas modestas |
| mistral:7b | 4.1GB | 8GB | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Alternativa |
| phi3:mini | 2.3GB | 4GB | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Mais leve |

---

## ✅ Checklist de Setup

- [ ] Ollama instalado (`ollama --version`)
- [ ] Modelo baixado (`ollama list`)
- [ ] Servidor rodando (`ollama serve`)
- [ ] Teste via CLI funcionando
- [ ] Teste via API REST funcionando
- [ ] Integração Node.js testada
- [ ] Configuração de performance ajustada

---

## 🔒 Considerações de Segurança

### **Isolamento de Rede**

Por padrão, Ollama escuta apenas em `localhost:11434`, o que é **seguro**.

**Não exponha Ollama publicamente:**
```bash
# ❌ NUNCA fazer isso em produção
ollama serve --host 0.0.0.0:11434
```

### **Firewall**

```powershell
# Windows: Bloquear porta 11434 externamente
New-NetFirewallRule -DisplayName "Block Ollama External" -Direction Inbound -LocalPort 11434 -Protocol TCP -Action Block -RemoteAddress Internet
```

### **Autenticação**

Ollama não tem autenticação nativa. Para ambientes sensíveis, use:
- Reverse proxy com autenticação (Nginx + HTTP Basic Auth)
- VPN para acesso remoto
- Firewall local

---

## 📚 Recursos Adicionais

**Documentação Oficial:**
- 🌐 https://ollama.com/docs
- 📦 https://github.com/ollama/ollama

**Modelos Disponíveis:**
- 🧠 https://ollama.com/library

**Comunidade:**
- 💬 Discord: https://discord.gg/ollama
- 🐙 GitHub Issues: https://github.com/ollama/ollama/issues

---

## 🚀 Próximos Passos

Após configurar Ollama:

1. ✅ Marcar setup como completo
2. 🔜 Implementar `OllamaClient.ts`
3. 🔜 Criar prompts para agentes
4. 🔜 Integrar com Audit Agent

---

**Status:** 📝 Guia Completo  
**Próxima Ação:** Instalar Ollama e testar  
**Tempo Estimado:** 15-30 minutos

---

**Comandos Rápidos para Copiar:**

```bash
# 1. Baixar modelo
ollama pull llama3.2:8b

# 2. Iniciar servidor (deixar rodando)
ollama serve

# 3. Testar (em outro terminal)
ollama run llama3.2:8b "Hello, teste em português"

# 4. Instalar SDK Node.js
cd backend && npm install ollama

# 5. Testar integração
node test-ollama.js
```

---

**Pronto! Ollama configurado e rodando. 🎉**

