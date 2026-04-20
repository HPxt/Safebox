/**
 * ContextManager - Gerenciador de Contexto para Agentes
 * 
 * Responsável por:
 * - Carregar documentação relevante
 * - Extrair princípios de segurança
 * - Validar contexto
 * - Monitorar mudanças nos documentos
 */

import fs from 'fs/promises';
import path from 'path';
import {
  AgentType,
  LoadedContext,
  ContextDocument,
  ContextSection,
  SecurityPrinciple
} from '../types';
import { logger } from '../../utils/logger';

export class ContextManager {
  private static readonly DOCS_BASE_PATH = path.join(__dirname, '../../../../docs/implementacao-ia');
  private static readonly getErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : 'Unknown context manager error';

  // Mapeamento de documentos obrigatórios por agente
  private static readonly REQUIRED_DOCS: Record<AgentType, string[]> = {
    [AgentType.AUDIT]: [
      '00-RESUMO-EXECUTIVO.md',
      '01-PLANO-INTEGRACAO.md',
      '06-CONTEXT-AWARENESS.md'
    ],
    [AgentType.HEALTH]: [
      '00-RESUMO-EXECUTIVO.md',
      '01-PLANO-INTEGRACAO.md',
      '05-PENTEST-AUTOMATIZADO.md'
    ],
    [AgentType.COMPLIANCE]: [
      '00-RESUMO-EXECUTIVO.md',
      '01-PLANO-INTEGRACAO.md',
      '02-PERGUNTAS-ESCLARECEDORAS.md'
    ],
    [AgentType.BREACH]: [
      '00-RESUMO-EXECUTIVO.md',
      '01-PLANO-INTEGRACAO.md'
    ]
  };

  // Princípios de segurança fundamentais
  private static readonly CORE_PRINCIPLES: SecurityPrinciple[] = [
    {
      id: 'zero_knowledge',
      principle: 'Zero-Knowledge Encryption',
      description: 'Senhas e chaves NUNCA são acessadas por IA',
      mandatory: true
    },
    {
      id: 'sanitization',
      principle: 'Data Sanitization',
      description: 'Todos os dados devem ser sanitizados antes do processamento',
      mandatory: true
    },
    {
      id: 'auditability',
      principle: 'Complete Auditability',
      description: 'Todas as ações devem ser auditadas',
      mandatory: true
    },
    {
      id: 'privacy_first',
      principle: 'Privacy First',
      description: 'Dados pessoais devem ser anonimizados',
      mandatory: true
    },
    {
      id: 'defensive_only',
      principle: 'Defensive Only',
      description: 'Apenas ferramentas defensivas, nada de ataque',
      mandatory: true
    }
  ];

  /**
   * Carrega contexto completo para um agente
   */
  async loadContext(agentType: AgentType): Promise<LoadedContext> {
    logger.info(`Loading context for ${agentType} agent...`);

    try {
      const requiredDocs = ContextManager.REQUIRED_DOCS[agentType];
      const documents: ContextDocument[] = [];

      // Carregar cada documento
      for (const docName of requiredDocs) {
        const doc = await this.loadDocument(docName);
        documents.push(doc);
      }

      const loadedContext: LoadedContext = {
        documents,
        principles: ContextManager.CORE_PRINCIPLES,
        loadedAt: new Date(),
        isValid: this.validateContext(documents)
      };

      logger.info(`Context loaded for ${agentType}`, {
        documentsLoaded: documents.length,
        principlesLoaded: loadedContext.principles.length,
        isValid: loadedContext.isValid
      });

      return loadedContext;

    } catch (error: any) {
      logger.error(`Failed to load context for ${agentType}`, {
        message: ContextManager.getErrorMessage(error)
      });

      throw new Error(`Context loading failed: ${ContextManager.getErrorMessage(error)}`);
    }
  }

  /**
   * Carrega um documento específico
   */
  private async loadDocument(fileName: string): Promise<ContextDocument> {
    const filePath = path.join(ContextManager.DOCS_BASE_PATH, fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const sections = this.parseMarkdown(content);

      return {
        name: fileName,
        path: filePath,
        content,
        sections
      };

    } catch (error: any) {
      logger.error(`Failed to load document ${fileName}`, {
        message: ContextManager.getErrorMessage(error),
        document: fileName
      });

      throw new Error(`Document ${fileName} not found or unreadable`);
    }
  }

  /**
   * Faz parse de markdown para extrair seções
   */
  private parseMarkdown(content: string): ContextSection[] {
    const sections: ContextSection[] = [];
    const lines = content.split('\n');

    let currentSection: ContextSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Detectar headings (# Título)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Salvar seção anterior
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Criar nova seção
        currentSection = {
          title: headingMatch[2],
          content: '',
          level: headingMatch[1].length
        };
        currentContent = [];

      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Salvar última seção
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Valida se o contexto está completo e válido
   */
  private validateContext(documents: ContextDocument[]): boolean {
    if (documents.length === 0) {
      logger.warn('No documents loaded in context');
      return false;
    }

    // Validar que todos os documentos têm conteúdo
    for (const doc of documents) {
      if (!doc.content || doc.content.trim().length === 0) {
        logger.warn(`Document ${doc.name} has no content`);
        return false;
      }

      if (doc.sections.length === 0) {
        logger.warn(`Document ${doc.name} has no sections`);
        return false;
      }
    }

    return true;
  }

  /**
   * Busca uma seção específica no contexto
   */
  findSection(context: LoadedContext, sectionTitle: string): ContextSection | null {
    for (const doc of context.documents) {
      for (const section of doc.sections) {
        if (section.title.toLowerCase().includes(sectionTitle.toLowerCase())) {
          return section;
        }
      }
    }

    return null;
  }

  /**
   * Busca princípio específico
   */
  findPrinciple(context: LoadedContext, principleId: string): SecurityPrinciple | null {
    return context.principles.find(p => p.id === principleId) || null;
  }

  /**
   * Extrai todos os princípios de segurança mencionados no contexto
   */
  extractSecurityPrinciples(context: LoadedContext): SecurityPrinciple[] {
    const principles: SecurityPrinciple[] = [...ContextManager.CORE_PRINCIPLES];

    // Buscar por seções de segurança nos documentos
    for (const doc of context.documents) {
      for (const section of doc.sections) {
        if (
          section.title.toLowerCase().includes('segurança') ||
          section.title.toLowerCase().includes('security') ||
          section.title.toLowerCase().includes('princípio')
        ) {
          // Extrair princípios mencionados no texto
          // TODO: Implementar parsing mais sofisticado com LLM se necessário
        }
      }
    }

    return principles;
  }

  /**
   * Verifica se um documento foi modificado
   */
  async hasDocumentChanged(fileName: string, lastLoadedAt: Date): Promise<boolean> {
    const filePath = path.join(ContextManager.DOCS_BASE_PATH, fileName);

    try {
      const stats = await fs.stat(filePath);
      return stats.mtime > lastLoadedAt;
    } catch (error) {
      logger.error(`Failed to check document change for ${fileName}`, {
        message: ContextManager.getErrorMessage(error),
        document: fileName
      });
      return false;
    }
  }

  /**
   * Recarrega contexto se houver mudanças
   */
  async reloadIfChanged(
    agentType: AgentType,
    currentContext: LoadedContext
  ): Promise<LoadedContext | null> {
    const requiredDocs = ContextManager.REQUIRED_DOCS[agentType];

    for (const docName of requiredDocs) {
      const hasChanged = await this.hasDocumentChanged(docName, currentContext.loadedAt);

      if (hasChanged) {
        logger.info(`Document ${docName} changed, reloading context for ${agentType}`);
        return await this.loadContext(agentType);
      }
    }

    return null; // Sem mudanças
  }

  /**
   * Obtém resumo do contexto carregado
   */
  getContextSummary(context: LoadedContext): string {
    const docsList = context.documents.map(d => d.name).join(', ');
    const principlesList = context.principles.map(p => p.principle).join(', ');

    return `
Context Summary:
- Documents: ${docsList}
- Principles: ${principlesList}
- Loaded At: ${context.loadedAt.toISOString()}
- Is Valid: ${context.isValid}
    `.trim();
  }

  /**
   * Lista documentos disponíveis
   */
  async listAvailableDocuments(): Promise<string[]> {
    try {
      const files = await fs.readdir(ContextManager.DOCS_BASE_PATH);
      return files.filter(f => f.endsWith('.md'));
    } catch (error) {
      logger.error('Failed to list available documents', {
        message: ContextManager.getErrorMessage(error)
      });
      return [];
    }
  }
}

