// Proteção contra XSS - sanitização de inputs
import DOMPurify from 'dompurify';

// Sanitizar HTML (se necessário no futuro)
export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: []
  });
};

// Sanitizar texto plano (remove qualquer HTML/scripts) - VERSÃO SEGURA
export const sanitizeText = (text: string): string => {
  // ⚠️ CORREÇÃO: Não usar innerHTML - vulnerável a XSS
  // Usar apenas textContent para escape seguro
  const div = document.createElement('div');
  div.textContent = text;
  return div.textContent || ''; // Retorna texto escapado
};

// Alternativa ainda mais segura usando apenas replace
export const sanitizeTextSecure = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
    .replace(/`/g, '&#x60;');
};

// Validar e sanitizar URLs
export const sanitizeURL = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    // Permitir apenas http/https e validar domínio
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Verificar se não é um domínio malicioso conhecido
    const maliciousDomains = ['javascript:', 'data:', 'vbscript:', 'file:'];
    if (maliciousDomains.some(domain => url.toLowerCase().includes(domain))) {
      return null;
    }
    
    return parsed.href;
  } catch {
    return null;
  }
};

// Escape caracteres especiais para prevenir injeção
export const escapeSpecialChars = (str: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '\\': '&#x5C;',
    '`': '&#x60;',
  };
  return str.replace(/[&<>"'/\\`]/g, (char) => map[char]);
};

// Validar input contra padrões maliciosos - VERSÃO APRIMORADA
export const isSafeInput = (input: string): boolean => {
  // Detectar tentativas de XSS comuns
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick, onload, etc.
    /<iframe\b[^>]*>/i,
    /<object\b[^>]*>/i,
    /<embed\b[^>]*>/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /<img[^>]*src[^>]*=/i,
    /<link[^>]*href[^>]*=/i,
    /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
    /data:\s*text\/html/i,
    /vbscript:/i,
    /<meta\b[^>]*>/i,
    /<base\b[^>]*>/i,
  ];
  
  return !xssPatterns.some(pattern => pattern.test(input));
};

// Validar entrada para SQL injection
export const isSafeSQLInput = (input: string): boolean => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(;|\-\-|\||\*)/g,
    /(\bOR\b.*=.*|\bAND\b.*=.*)/gi,
    /('|('')|"|(\"))/g, // Aspas que podem ser usadas para injection
    /(\b(SCRIPT|EXEC|EXECUTE|SP_|XP_)\b)/gi,
  ];
  
  return !sqlPatterns.some(pattern => pattern.test(input));
};

// Criar Content Security Policy nonce
export const generateCSPNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)));
};

// Validação completa de entrada
export const validateInput = (input: string, maxLength: number = 1000): { 
  isValid: boolean; 
  errors: string[] 
} => {
  const errors: string[] = [];
  
  if (input.length > maxLength) {
    errors.push(`Input too long (max ${maxLength} characters)`);
  }
  
  if (!isSafeInput(input)) {
    errors.push('Input contains potentially dangerous content');
  }
  
  if (!isSafeSQLInput(input)) {
    errors.push('Input contains SQL injection patterns');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}; 