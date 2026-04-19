# 🚀 Setup do LM Studio - GPT OSS 20B

> **Guia para configurar LM Studio para uso com SafeBox AI**

---

## ✅ Você Já Tem Tudo!

Como você já tem o **GPT OSS 20B instalado no LM Studio**, só precisamos configurar a API.

---

## 🔧 Configuração Rápida

### **1. Abrir LM Studio**

1. Inicie o LM Studio
2. Carregue o modelo **GPT OSS 20B**
3. Verifique que está carregado na memória

---

### **2. Iniciar o Servidor Local**

No LM Studio:

1. Clique na aba **"Local Server"** (servidor local)
2. Clique em **"Start Server"** (iniciar servidor)
3. Porta padrão: `1234`
4. Endpoint: `http://localhost:1234/v1`

**O servidor ficará assim:**
```
✅ Server running on http://localhost:1234
Model: GPT OSS 20B
Status: Ready
```

---

### **3. Testar a API**

Abra PowerShell e teste:

```powershell
# Testar endpoint
curl http://localhost:1234/v1/models

# Deve retornar algo como:
# {
#   "data": [
#     {
#       "id": "gpt-oss-20b",
#       "object": "model",
#       ...
#     }
#   ]
# }
```

---

## 📝 Configurar no SafeBox

### **Variáveis de Ambiente**

Edite `backend/.env`:

```bash
# LM Studio Configuration
LLM_PROVIDER=lmstudio
LMSTUDIO_HOST=http://localhost:1234
LMSTUDIO_MODEL=gpt-oss-20b
LLM_TIMEOUT=120000  # 2 minutos (modelo maior)
LLM_MAX_RETRIES=3
```

---

## 🔌 Integração com Node.js

O código que criamos já funciona! Só precisa ajustar o host.

### **Atualizar OllamaClient.ts** (vamos renomear para LLMClient.ts)

```typescript
// backend/src/ai/llm/LLMClient.ts
import axios, { AxiosInstance } from 'axios';

export class LLMClient {
  private client: AxiosInstance;
  private config: {
    host: string;
    model: string;
    timeout: number;
  };

  constructor() {
    // LM Studio usa API compatível com OpenAI
    this.config = {
      host: process.env.LMSTUDIO_HOST || 'http://localhost:1234',
      model: process.env.LMSTUDIO_MODEL || 'gpt-oss-20b',
      timeout: parseInt(process.env.LLM_TIMEOUT || '120000')
    };

    this.client = axios.create({
      baseURL: `${this.config.host}/v1`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async generate(request: {
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    const response = await this.client.post('/chat/completions', {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: request.systemPrompt || 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: request.prompt
        }
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 512
    });

    return {
      response: response.data.choices[0].message.content,
      tokensUsed: {
        prompt: response.data.usage.prompt_tokens,
        completion: response.data.usage.completion_tokens,
        total: response.data.usage.total_tokens
      },
      processingTime: 0,
      model: this.config.model
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/models');
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## ⚙️ Configurações Recomendadas LM Studio

### **Para Análise de Segurança:**

**Context Length:** 4096 tokens  
**Temperature:** 0.7 (balanceado)  
**Top P:** 0.9  
**Repeat Penalty:** 1.1  
**GPU Layers:** Máximo possível (para velocidade)

### **No LM Studio:**
1. **Settings** → **Inference**
2. Ajustar conforme acima
3. Salvar configuração

---

## 🧪 Testar Integração

### **Script de Teste:**

```bash
# backend/test-lmstudio.js
cd backend
node test-lmstudio.js
```

```javascript
const axios = require('axios');

async function testLMStudio() {
  console.log('🧪 Testando LM Studio...\n');

  try {
    const response = await axios.post('http://localhost:1234/v1/chat/completions', {
      model: 'gpt-oss-20b',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em segurança cibernética.'
        },
        {
          role: 'user',
          content: 'Liste 3 principais ameaças de segurança em APIs REST'
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    console.log('✅ LM Studio está funcionando!\n');
    console.log('📝 Resposta:');
    console.log(response.data.choices[0].message.content);
    console.log('\n📊 Tokens usados:', response.data.usage.total_tokens);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n💡 Verifique se:');
    console.log('  1. LM Studio está aberto');
    console.log('  2. Servidor local está rodando (porta 1234)');
    console.log('  3. Modelo GPT OSS 20B está carregado');
  }
}

testLMStudio();
```

**Executar:**
```bash
node test-lmstudio.js
```

---

## 📊 Comparação: Ollama vs LM Studio

| Aspecto | Ollama | LM Studio |
|---------|--------|-----------|
| **Interface** | CLI | GUI moderna ⭐ |
| **API** | Própria | OpenAI-compatible ⭐ |
| **Facilidade** | Precisa instalar modelo | Você já tem ⭐ |
| **Modelo Atual** | Llama 3.2 3B | GPT OSS 20B ⭐ |
| **Precisão** | Boa | Excelente ⭐ |
| **Gerenciamento** | Linha de comando | Visual ⭐ |

**Vencedor:** LM Studio para o seu caso! 🏆

---

## 🔧 Comandos Úteis

### **Verificar se LM Studio está rodando:**
```powershell
curl http://localhost:1234/v1/models
```

### **Ver modelos disponíveis:**
```powershell
curl http://localhost:1234/v1/models | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object id
```

### **Reiniciar servidor LM Studio:**
1. Clicar em "Stop Server"
2. Aguardar 2 segundos
3. Clicar em "Start Server"

---

## ⚠️ Troubleshooting

### **Problema: "Connection refused"**

**Solução:**
1. Abrir LM Studio
2. Verificar aba "Local Server"
3. Clicar em "Start Server"
4. Aguardar inicialização (10-30 segundos)

---

### **Problema: Respostas muito lentas**

**Soluções:**
1. **Aumentar GPU Layers:**
   - LM Studio → Settings → GPU Offload → Máximo
   
2. **Reduzir Context Length:**
   - Settings → Context Length → 2048

3. **Usar modelo menor (se necessário):**
   - Voltar para Llama 3.2 8B (mas perde precisão)

---

### **Problema: Modelo não carrega**

**Soluções:**
1. Fechar outros programas pesados
2. Reiniciar LM Studio
3. Verificar memória RAM disponível (precisa ~16GB)

---

## 💡 Dicas de Performance

### **Para Máxima Velocidade:**
- GPU Offload: 100%
- Batch Size: 512
- Threads: 8-12 (ou quantidade de cores da CPU)

### **Para Máxima Precisão:**
- Temperature: 0.5-0.7
- Top P: 0.9
- Context Length: 4096

### **Para Balanceado (Recomendado):**
- GPU Offload: 80-90%
- Temperature: 0.7
- Context Length: 2048
- Batch Size: 256

---

## ✅ Checklist de Setup

- [ ] LM Studio instalado
- [ ] Modelo GPT OSS 20B carregado ✅ (você já tem)
- [ ] Servidor local iniciado (porta 1234)
- [ ] Teste da API funcionando
- [ ] Variáveis de ambiente configuradas (`backend/.env`)
- [ ] Script de teste executado com sucesso

---

## 🎯 Próximos Passos

Após configurar LM Studio:

1. ✅ Marcar setup como completo
2. 🔜 Atualizar `OllamaClient.ts` → `LLMClient.ts`
3. 🔜 Testar com agentes
4. 🔜 Continuar com Audit Agent

---

## 📚 Recursos

**Documentação LM Studio:**
- 🌐 https://lmstudio.ai/docs

**API Reference:**
- 📖 https://platform.openai.com/docs/api-reference (compatível)

**Suporte:**
- 💬 Discord LM Studio
- 🐙 GitHub Issues

---

**Status:** ✅ Configuração Simplificada  
**Modelo:** GPT OSS 20B (20 bilhões de parâmetros)  
**Provider:** LM Studio  
**API:** OpenAI-compatible  
**Custo:** $0 (100% local)  

---

🚀 **LM Studio configurado e pronto para uso!**

