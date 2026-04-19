# 🧪 Referência: Jest Testing Framework

> Documentação coletada em: 2025-01-06
> Fonte: Context7 - /websites/jestjs_io-docs-getting-started

## 🎯 Snippets Principais para Testes de Segurança

### 1. Mock de Funções Básico

```javascript
const mockCallback = jest.fn(x => 42 + x);

test('forEach mock function', () => {
  forEach([0, 1], mockCallback);

  // Mock foi chamado duas vezes
  expect(mockCallback.mock.calls).toHaveLength(2);

  // Primeiro argumento da primeira chamada foi 0
  expect(mockCallback.mock.calls[0][0]).toBe(0);

  // Valor de retorno da primeira chamada foi 42
  expect(mockCallback.mock.results[0].value).toBe(42);
});
```

---

### 2. Testes Assíncronos com Async/Await

```javascript
test('testa dados assíncronos', async () => {
  const data = await fetchData();
  expect(data).toBe('peanut butter');
});

test('testa erro assíncrono', async () => {
  expect.assertions(1);
  try {
    await fetchData();
  } catch (error) {
    expect(error).toMatch('error');
  }
});
```

---

### 3. Mock de Promises com Resolves/Rejects

```javascript
test('mock resolve', async () => {
  const asyncMock = jest.fn().mockResolvedValue(43);
  await asyncMock(); // 43
});

test('mock reject', async () => {
  const asyncMock = jest
    .fn()
    .mockRejectedValue(new Error('Async error message'));

  await asyncMock(); // throws error
});
```

---

### 4. Mock de Módulos Externos (Axios)

```javascript
import axios from 'axios';
import Users from './users';

jest.mock('axios');

test('deve buscar usuários', () => {
  const users = [{name: 'Bob'}];
  const resp = {data: users};
  axios.get.mockResolvedValue(resp);

  return Users.all().then(data => expect(data).toEqual(users));
});
```

---

### 5. Mock Sequencial com mockResolvedValueOnce

```javascript
test('diferentes valores em múltiplas chamadas', async () => {
  const asyncMock = jest
    .fn()
    .mockResolvedValue('default')
    .mockResolvedValueOnce('first call')
    .mockResolvedValueOnce('second call');

  await asyncMock(); // 'first call'
  await asyncMock(); // 'second call'
  await asyncMock(); // 'default'
  await asyncMock(); // 'default'
});
```

---

### 6. Spy em Funções

```javascript
const logSpy = jest.spyOn(logger, 'info');

await auditAgent.analyze(data);

const logCalls = logSpy.mock.calls.flat().join('');
expect(logCalls).not.toContain('senha123');
```

---

### 7. Mock Manual de Requisições

```javascript
// __mocks__/request.js
const users = {
  4: {name: 'Mark'},
  5: {name: 'Paul'},
};

export default function request(url) {
  return new Promise((resolve, reject) => {
    const userID = parseInt(url.slice('/users/'.length), 10);
    process.nextTick(() =>
      users[userID]
        ? resolve(users[userID])
        : reject({ error: `User with ${userID} not found.` }),
    );
  });
}
```

---

### 8. Matchers Customizados

```javascript
// Mock foi chamado
expect(mockFunc).toHaveBeenCalled();

// Mock foi chamado com argumentos específicos
expect(mockFunc).toHaveBeenCalledWith(arg1, arg2);

// Última chamada teve argumentos específicos
expect(mockFunc).toHaveBeenLastCalledWith(arg1, arg2);

// Snapshot de todas as chamadas
expect(mockFunc).toMatchSnapshot();
```

---

### 9. Mock de Date.now() para Testes Determinísticos

```javascript
Date.now = jest.fn(() => 1_482_363_367_071);
```

---

### 10. beforeEach e afterEach

```javascript
let spiedFunction;

beforeEach(() => {
  // Setup antes de cada teste
  spiedFunction = jest.spyOn(module, 'function');
});

afterEach(() => {
  // Cleanup após cada teste
  spiedFunction?.mockReset();
});
```

---

## 🔒 Aplicações para Testes de Segurança no SafeBox

### **Teste de Sanitização (TS-001):**
```typescript
describe('Sanitização - Senhas', () => {
  it('deve bloquear senhas descriptografadas', async () => {
    const log = {
      password: 'senha123',
      encrypted_data: 'AES256...'
    };
    
    const sanitized = sanitizeForAI(log);
    
    expect(sanitized).not.toHaveProperty('password');
    expect(sanitized).not.toHaveProperty('encrypted_data');
  });
});
```

### **Teste de Vazamento (TS-002):**
```typescript
describe('Vazamento - Logs', () => {
  it('não deve logar dados sensíveis', async () => {
    const logSpy = jest.spyOn(logger, 'info');
    
    await auditAgent.analyze({
      user_email: 'test@example.com',
      password: 'senha123'
    });
    
    const logCalls = logSpy.mock.calls.flat().join('');
    
    expect(logCalls).not.toContain('senha123');
    expect(logCalls).not.toContain('password');
  });
});
```

### **Teste de APIs Externas (TI-002):**
```typescript
describe('Integração - HIBP API', () => {
  it('deve ter fallback quando API falhar', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('API Error'));
    
    const result = await breachDetector.checkEmail('test@example.com');
    
    expect(result).toMatchObject({
      isBreached: false,
      error: 'Serviço temporariamente indisponível',
      usedCache: true
    });
  });
});
```

### **Teste de Performance (TP-001):**
```typescript
describe('Performance - Latência', () => {
  it('deve analisar 100 logs em < 2 segundos', async () => {
    const logs = generateLogs(100);
    
    const start = Date.now();
    await auditAgent.analyze(logs);
    const duration = Date.now() - start;
    
    expect(duration).toBeLessThan(2000);
  });
});
```

---

**Última Atualização:** 2025-01-06
**Versão:** v1.0

