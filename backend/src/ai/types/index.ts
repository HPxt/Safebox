/**
 * Tipos e Interfaces para o Sistema de IA de Segurança
 * SafeBox - Zero-Knowledge Password Manager
 */

// ===== ENUMS =====

export enum AgentType {
  AUDIT = 'audit',
  HEALTH = 'health',
  COMPLIANCE = 'compliance',
  BREACH = 'breach'
}

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
  COMPLETED = 'completed'
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ActionType {
  ALERT = 'alert',
  LOG = 'log',
  SUGGEST = 'suggest',
  AUTOMATE = 'automate',
  BLOCK = 'block',
  NOTIFY = 'notify'
}

export enum AgentAutomationLevel {
  ALERTS_ONLY = 1,
  SUGGEST_ACTIONS = 2,
  PARTIAL_AUTOMATION = 3,
  FULL_AUTOMATION = 4
}

// ===== INTERFACES BASE =====

export interface AgentContext {
  agentId: string;
  agentType: AgentType;
  executionId: string;
  timestamp: Date;
  config: AgentConfig;
}

export interface AgentConfig {
  enabled: boolean;
  automationLevel: 1 | 2 | 3 | 4; // Nível de automação
  schedule: string; // Cron expression
  maxRetries: number;
  timeout: number; // em segundos
}

export interface AgentResult {
  executionId: string;
  agentType: AgentType;
  timestamp: Date;
  status: 'completed' | 'failed' | 'partial';
  findings: Finding[];
  actions: Action[];
  summary: string;
  metrics: {
    logsAnalyzed?: number;
    findingsCount: number;
    criticalFindings: number;
    executionTime: number;
  };
  error?: string;
}

export interface Finding {
  id: string;
  severity: SeverityLevel;
  category: string;
  title: string;
  description: string;
  affectedResource?: string;
  evidence?: Record<string, any>;
  recommendations: string[];
  timestamp: Date;
}

export interface Action {
  id: string;
  type: ActionType;
  description: string;
  requiresApproval: boolean;
  approved?: boolean;
  executed: boolean;
  executedAt?: Date;
  result?: string;
}

// ===== DADOS SANITIZADOS =====

export interface SanitizedAuditLog {
  event_type: string;
  timestamp: Date;
  user_id_hash: string; // SHA-256 hash
  ip_anonymized: string; // Últimos octetos mascarados
  success: boolean;
  metadata?: {
    action?: string;
    resource_type?: string;
  };
}

export interface SanitizedHealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  metrics: {
    response_time?: number;
    error_rate?: number;
    availability?: number;
  };
}

export interface SanitizedComplianceData {
  framework: 'LGPD' | 'GDPR' | 'ISO27001' | 'SOC2';
  controls: ComplianceControl[];
  timestamp: Date;
}

export interface ComplianceControl {
  controlId: string;
  name: string;
  status: 'compliant' | 'non_compliant' | 'partial';
  evidence?: string[];
  gaps?: string[];
}

export interface SanitizedBreachData {
  email_hash: string; // SHA-256 hash
  breach_count?: number;
  last_breach_date?: Date;
  source: string; // 'hibp' ou 'internal'
}

// ===== LLM INTERFACES =====

export interface LLMRequest {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  response: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  processingTime: number; // em ms
  model: string;
}

// ===== STORAGE INTERFACES =====

export interface StorageEntry {
  id: string;
  agentType: AgentType;
  executionId: string;
  timestamp: Date;
  data: Record<string, any>;
  ttl?: number; // Time to live (em segundos, para Redis)
}

export interface ReportSummary {
  id: string;
  agentType: AgentType;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  topFindings: Finding[];
  recommendations: string[];
}

// ===== CONTEXT LOADING =====

export interface LoadedContext {
  documents: ContextDocument[];
  principles: SecurityPrinciple[];
  loadedAt: Date;
  isValid: boolean;
}

export interface ContextDocument {
  name: string;
  path: string;
  content: string;
  sections: ContextSection[];
}

export interface ContextSection {
  title: string;
  content: string;
  level: number; // Nível do heading (1-6)
}

export interface SecurityPrinciple {
  id: string;
  principle: string;
  description: string;
  mandatory: boolean;
}

// ===== VALIDAÇÃO =====

export interface ValidationResult {
  isValid: boolean;
  violations: SecurityViolation[];
  warnings: string[];
}

export interface SecurityViolation {
  principle: string;
  description: string;
  severity: SeverityLevel;
  detectedIn: string;
}

// ===== SCHEDULING =====

export interface ScheduleConfig {
  agentType: AgentType;
  cronExpression: string;
  enabled: boolean;
  timezone: string;
  lastRun?: Date;
  nextRun?: Date;
}

export interface JobExecution {
  id: string;
  agentType: AgentType;
  startedAt: Date;
  completedAt?: Date;
  status: AgentStatus;
  result?: AgentResult;
  error?: string;
}

// ===== TIPOS UTILITÁRIOS =====

export type ForbiddenDataType = 
  | 'password'
  | 'master_password'
  | 'encryption_key'
  | 'decrypted_data'
  | 'private_key'
  | 'api_key';

export interface DataClassification {
  type: string;
  isSensitive: boolean;
  isForbidden: boolean;
  sanitizationRequired: boolean;
  allowedForAI: boolean;
}

// ===== AUDITORIA DE IA =====

export interface AIAuditLog {
  id: string;
  agentType: AgentType;
  action: string;
  dataAccessed: string[]; // Tipos de dados acessados (não os dados em si)
  sanitized: boolean;
  timestamp: Date;
  executionId: string;
  userId?: string;
  result: 'success' | 'failure' | 'partial';
  details?: Record<string, any>;
}

// ===== EXPORTS AGRUPADOS =====

export type {
  // Contexto e Configuração
  AgentContext,
  AgentConfig,
  
  // Resultados e Findings
  AgentResult,
  Finding,
  Action,
  
  // Dados Sanitizados
  SanitizedAuditLog,
  SanitizedHealthCheck,
  SanitizedComplianceData,
  SanitizedBreachData,
  ComplianceControl,
  
  // LLM
  LLMRequest,
  LLMResponse,
  
  // Storage
  StorageEntry,
  ReportSummary,
  
  // Context Loading
  LoadedContext,
  ContextDocument,
  ContextSection,
  SecurityPrinciple,
  
  // Validação
  ValidationResult,
  SecurityViolation,
  
  // Scheduling
  ScheduleConfig,
  JobExecution,
  
  // Utilitários
  ForbiddenDataType,
  DataClassification,
  AIAuditLog
};

