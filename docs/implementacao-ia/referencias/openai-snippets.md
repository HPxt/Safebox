# 📚 Referência: OpenAI Node.js SDK

> Documentação coletada em: 2025-01-06
> Fonte: Context7 - /openai/openai-node

## 🎯 Snippets Principais para o Projeto

### 1. Chat Completions Básico

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'developer', content: 'Talk like a pirate.' },
    { role: 'user', content: 'Are semicolons optional in JavaScript?' },
  ],
});

console.log(completion.choices[0].message.content);
```

---

### 2. Function Calling com runTools (Agentes)

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'How is the weather this week?' }],
      tools: [
        {
          type: 'function',
          function: {
            function: getCurrentLocation,
            parameters: { type: 'object', properties: {} },
          },
        },
        {
          type: 'function',
          function: {
            function: getWeather,
            parse: JSON.parse, // ou use Zod para parsing tipado
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
            },
          },
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalContent = await runner.finalContent();
  console.log('Final content:', finalContent);
}

async function getCurrentLocation() {
  return 'Boston';
}

async function getWeather(args: { location: string }) {
  const { location } = args;
  // Buscar dados do clima
  return { temperature, precipitation };
}

main();
```

---

### 3. Validação com Zod

```typescript
import { zodFunction } from 'openai/helpers/zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai/index';
import { z } from 'zod';

// Schema para validação de entrada
const Query = z.object({
  table_name: z.enum(['orders', 'customers', 'products']),
  columns: z.array(z.string()),
  conditions: z.array(z.object({
    column: z.string(),
    operator: z.enum(['=', '>', '<', '<=', '>=', '!=']),
    value: z.union([z.string(), z.number()]),
  })),
});

// Schema para resposta estruturada
const MathResponse = z.object({
  steps: z.array(z.object({
    explanation: z.string(),
    output: z.string(),
  })),
  final_answer: z.string(),
});

const client = new OpenAI();

// Usando zodResponseFormat para resposta estruturada
const completion = await client.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [
    { role: 'system', content: 'You are a helpful math tutor.' },
    { role: 'user', content: 'solve 8x + 31 = 2' },
  ],
  response_format: zodResponseFormat(MathResponse, 'math_response'),
});

const message = completion.choices[0]?.message;
if (message?.parsed) {
  console.log(message.parsed.steps);
  console.log(`answer: ${message.parsed.final_answer}`);
}
```

---

### 4. Error Handling

```typescript
const job = await client.fineTuning.jobs
  .create({ model: 'gpt-4o', training_file: 'file-abc123' })
  .catch(async (err) => {
    if (err instanceof OpenAI.APIError) {
      console.log(err.request_id);
      console.log(err.status); // 400
      console.log(err.name); // BadRequestError
      console.log(err.headers);
    } else {
      throw err;
    }
  });
```

---

### 5. Streaming de Respostas

```typescript
const stream = await openai.chat.completions.stream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Say this is a test' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

---

### 6. Abort em Function Calls

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function main() {
  const runner = client.chat.completions
    .runTools({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: "How's the weather this week?" }],
      tools: [
        {
          type: 'function',
          function: {
            function: function dangerousAction(props, runner) {
              // Abortar se ação perigosa for detectada
              runner.abort();
            },
          },
        },
      ],
    })
    .on('message', (message) => console.log(message));

  const finalFunctionCall = await runner.finalFunctionCall();
  console.log('Final function call:', finalFunctionCall);
}
```

---

## 🔧 Aplicações para SafeBox

### **Audit Agent:**
- Usar function calling para análise de logs
- Schema Zod para validar eventos de segurança
- Streaming para análises em tempo real

### **Breach Detector:**
- Function calling para verificação externa (HIBP)
- Error handling robusto
- Validação de resposta com Zod

### **Health Monitor:**
- Múltiplas tools para diferentes verificações
- Resposta estruturada com Zod
- Abort em verificações críticas

### **Compliance Checker:**
- Schema complexo com Zod
- Function calling para verificações específicas
- Respostas estruturadas JSON

---

**Última Atualização:** 2025-01-06
**Versão:** v1.0

