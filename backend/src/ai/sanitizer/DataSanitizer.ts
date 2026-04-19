/**
 * DataSanitizer - Sanitização Rigorosa de Dados para IA
 * 
 * PRINCÍPIO FUNDAMENTAL: ZERO-KNOWLEDGE PRESERVADO
 * - Senhas NUNCA são processadas
 * - Chaves de criptografia NUNCA são processadas
 * - Master password NUNCA é processado
 * - Apenas metadados não-sensíveis são permitidos
 */

import crypto from 'crypto';
import {
  SanitizedAuditLog,
  SanitizedHealthCheck,
  SanitizedComplianceData,
  SanitizedBreachData,
  DataClassification,
  ForbiddenDataType
} from '../types';

export class DataSanitizer {
  // Lista negra absoluta - NUNCA processar estes campos
  private static readonly FORBIDDEN_FIELDS: ForbiddenDataType[] = [
    'password',
    'master_password',
    'encryption_key',
    'decrypted_data',
    'private_key',
    'api_key'
  ];

  // Campos que precisam ser hasheados
  private static readonly HASH_FIELDS = [
    'user_id',
    'email',
    'username'
  ];

  // Campos que precisam ser anonimizados
  private static readonly ANONYMIZE_FIELDS = [
    'ip',
    'ip_address',
    'ipv4',
    'ipv6'
  ];

  /**
   * Valida se um campo é proibido para processamento por IA
   */
  public static isForbidden(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase();
    return this.FORBIDDEN_FIELDS.some(forbidden => 
      lowerField.includes(forbidden)
    );
  }

  /**
   * Classifica um tipo de dado
   */
  public static classifyData(fieldName: string): DataClassification {
    const isForbidden = this.isForbidden(fieldName);
    const needsHash = this.HASH_FIELDS.some(f => fieldName.includes(f));
    const needsAnonymization = this.ANONYMIZE_FIELDS.some(f => fieldName.includes(f));

    return {
      type: fieldName,
      isSensitive: needsHash || needsAnonymization,
      isForbidden,
      sanitizationRequired: needsHash || needsAnonymization,
      allowedForAI: !isForbidden
    };
  }

  /**
   * Sanitiza log de auditoria
   */
  public static sanitizeAuditLog(log: any): SanitizedAuditLog {
    // Validação: garantir que não há dados proibidos
    this.validateNoForbiddenData(log, 'AuditLog');

    return {
      event_type: log.event_type || log.type || 'unknown',
      timestamp: new Date(log.timestamp || Date.now()),
      user_id_hash: log.user_id ? this.hashData(log.user_id) : 'anonymous',
      ip_anonymized: log.ip ? this.anonymizeIP(log.ip) : 'unknown',
      success: Boolean(log.success),
      metadata: {
        action: log.action || log.metadata?.action,
        resource_type: log.resource_type || log.metadata?.resource_type
      }
    };
  }

  /**
   * Sanitiza health check
   */
  public static sanitizeHealthCheck(check: any): SanitizedHealthCheck {
    return {
      component: check.component || check.service || 'unknown',
      status: this.normalizeHealthStatus(check.status),
      timestamp: new Date(check.timestamp || Date.now()),
      metrics: {
        response_time: this.sanitizeNumeric(check.response_time),
        error_rate: this.sanitizeNumeric(check.error_rate),
        availability: this.sanitizeNumeric(check.availability)
      }
    };
  }

  /**
   * Sanitiza dados de compliance
   */
  public static sanitizeComplianceData(data: any): SanitizedComplianceData {
    return {
      framework: data.framework,
      controls: data.controls?.map((control: any) => ({
        controlId: control.id || control.controlId,
        name: control.name,
        status: control.status,
        evidence: control.evidence?.map((e: string) => 
          this.sanitizeString(e, 200)
        ),
        gaps: control.gaps
      })) || [],
      timestamp: new Date(data.timestamp || Date.now())
    };
  }

  /**
   * Sanitiza dados de breach
   */
  public static sanitizeBreachData(data: any): SanitizedBreachData {
    return {
      email_hash: this.hashData(data.email || data.email_address),
      breach_count: this.sanitizeNumeric(data.breach_count),
      last_breach_date: data.last_breach_date ? new Date(data.last_breach_date) : undefined,
      source: data.source || 'unknown'
    };
  }

  /**
   * Hash SHA-256 de dados sensíveis
   */
  public static hashData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Anonimiza endereço IP (mascarar últimos octetos)
   */
  public static anonymizeIP(ip: string): string {
    if (!ip) return 'unknown';

    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
      }
    }

    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return `${parts[0]}:${parts[1]}:${parts[2]}:xxxx:xxxx:xxxx:xxxx:xxxx`;
      }
    }

    return 'unknown';
  }

  /**
   * Valida que não há dados proibidos no objeto
   */
  private static validateNoForbiddenData(data: any, context: string): void {
    if (typeof data !== 'object' || data === null) return;

    for (const key of Object.keys(data)) {
      if (this.isForbidden(key)) {
        throw new Error(
          `SECURITY VIOLATION: Forbidden field '${key}' detected in ${context}. ` +
          `This data MUST NOT be processed by AI.`
        );
      }

      // Validação recursiva
      if (typeof data[key] === 'object' && data[key] !== null) {
        this.validateNoForbiddenData(data[key], `${context}.${key}`);
      }
    }
  }

  /**
   * Normaliza status de health check
   */
  private static normalizeHealthStatus(status: string): 'healthy' | 'degraded' | 'unhealthy' {
    const normalized = status?.toLowerCase();
    
    if (['healthy', 'ok', 'up', 'running'].includes(normalized)) {
      return 'healthy';
    }
    
    if (['degraded', 'slow', 'warning'].includes(normalized)) {
      return 'degraded';
    }
    
    return 'unhealthy';
  }

  /**
   * Sanitiza valores numéricos
   */
  private static sanitizeNumeric(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Sanitiza strings (remove PII potencial, limita tamanho)
   */
  private static sanitizeString(str: string, maxLength: number = 500): string {
    if (!str) return '';
    
    // Remove emails
    str = str.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]');
    
    // Remove números de telefone
    str = str.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
    
    // Remove tokens/keys suspeitos (strings longas de caracteres aleatórios)
    str = str.replace(/\b[A-Za-z0-9]{32,}\b/g, '[TOKEN_REDACTED]');
    
    // Limita tamanho
    if (str.length > maxLength) {
      str = str.substring(0, maxLength) + '...';
    }
    
    return str;
  }

  /**
   * Remove campos proibidos de um objeto (deep cleaning)
   */
  public static deepClean(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.deepClean(item));
    }

    const cleaned: any = {};

    for (const [key, value] of Object.entries(data)) {
      // Pular campos proibidos
      if (this.isForbidden(key)) {
        continue;
      }

      // Hash campos sensíveis
      if (this.HASH_FIELDS.some(f => key.includes(f))) {
        cleaned[`${key}_hash`] = this.hashData(String(value));
        continue;
      }

      // Anonimizar IPs
      if (this.ANONYMIZE_FIELDS.some(f => key.includes(f))) {
        cleaned[`${key}_anonymized`] = this.anonymizeIP(String(value));
        continue;
      }

      // Recursão para objetos aninhados
      if (typeof value === 'object' && value !== null) {
        cleaned[key] = this.deepClean(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Valida se um objeto é seguro para processar
   */
  public static isSafeForAI(data: any): { safe: boolean; violations: string[] } {
    const violations: string[] = [];

    const check = (obj: any, path: string = 'root') => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const [key, value] of Object.entries(obj)) {
        const fullPath = `${path}.${key}`;

        if (this.isForbidden(key)) {
          violations.push(`Forbidden field: ${fullPath}`);
        }

        if (typeof value === 'object' && value !== null) {
          check(value, fullPath);
        }
      }
    };

    check(data);

    return {
      safe: violations.length === 0,
      violations
    };
  }

  /**
   * Método genérico de sanitização
   * Detecta o tipo de dado e aplica a sanitização apropriada
   */
  public static sanitize(data: any): any {
    // Se for undefined ou null, retornar objeto vazio
    if (!data) {
      return {};
    }

    // Detectar tipo de dado baseado nas propriedades
    if (data.action || data.event_type || data.status) {
      // Provavelmente é um log de auditoria
      return this.sanitizeAuditLog(data);
    }

    if (data.component || data.service) {
      // Provavelmente é um health check
      return this.sanitizeHealthCheck(data);
    }

    // Para dados genéricos, fazer deep clean
    return this.deepClean(data);
  }
}

