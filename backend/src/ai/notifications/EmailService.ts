/**
 * EmailService - Envio de Relatórios por Email
 * 
 * Envia relatórios de análise de segurança por email com PDF anexado
 */

import nodemailer from 'nodemailer';
import { AgentType, AgentResult } from '../types';
import { logger } from '../../utils/logger';

export interface EmailConfig {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  secure: boolean; // true para 465, false para outros
  user: string;
  password: string;
  from: string;
  to: string;
  sendOnlyOnFindings: boolean; // Enviar apenas se houver descobertas
  sendCriticalImmediately: boolean; // Enviar imediatamente se crítico
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;
  private static getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown email service error';
  }

  constructor(config?: Partial<EmailConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
      smtpHost: config?.smtpHost || process.env['SMTP_HOST'] || '',
      smtpPort: config?.smtpPort || parseInt(process.env['SMTP_PORT'] || '587'),
      secure: config?.secure ?? false,
      user: config?.user || process.env['SMTP_USER'] || '',
      password: config?.password || process.env['SMTP_PASSWORD'] || '',
      from: config?.from || process.env['EMAIL_FROM'] || 'SafeBox Security <noreply@safebox.com>',
      to: config?.to || process.env['EMAIL_TO'] || '',
      sendOnlyOnFindings: config?.sendOnlyOnFindings ?? true,
      sendCriticalImmediately: config?.sendCriticalImmediately ?? true
    };

    // Criar transporter do nodemailer
    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password
      }
    });

    logger.info('EmailService initialized', {
      port: this.config.smtpPort,
      enabled: this.config.enabled && Boolean(this.config.to),
    });
  }

  /**
   * Envia relatório por email com PDF anexado
   */
  async sendReport(
    agentType: AgentType,
    result: AgentResult,
    executionId: string,
    pdfPath: string
  ): Promise<boolean> {
    if (!this.config.enabled || !this.config.to) {
      logger.info('Email notifications disabled');
      return false;
    }

    // Verificar se deve enviar
    if (!this.shouldSendEmail(result)) {
      logger.info('Skipping email - no findings detected');
      return false;
    }

    try {
      const agentName = this.getAgentName(agentType);
      const subject = this.buildSubject(agentName, result);
      const html = this.buildEmailHTML(agentName, result, executionId);

      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject,
        html,
        attachments: [
          {
            filename: `relatorio-${agentName}-${executionId.slice(0, 8)}.pdf`,
            path: pdfPath
          }
        ]
      };

      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        agentType,
        executionId
      });

      return true;

    } catch (error: any) {
      logger.error('Failed to send email', {
        message: EmailService.getErrorMessage(error),
        agentType,
        executionId
      });

      return false;
    }
  }

  /**
   * Envia alerta crítico imediato
   */
  async sendCriticalAlert(
    agentType: AgentType,
    criticalFindings: any[],
    executionId: string
  ): Promise<boolean> {
    if (!this.config.enabled || !this.config.sendCriticalImmediately || !this.config.to) {
      return false;
    }

    try {
      const agentName = this.getAgentName(agentType);
      const subject = `🚨 ALERTA CRÍTICO - ${agentName}`;
      const html = this.buildCriticalAlertHTML(agentName, criticalFindings);

      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject,
        html,
        priority: 'high' as const
      };

      await this.transporter.sendMail(mailOptions);

      logger.info('Critical alert sent', {
        agentType,
        findingsCount: criticalFindings.length
      });

      return true;

    } catch (error: any) {
      logger.error('Failed to send critical alert', {
        message: EmailService.getErrorMessage(error)
      });

      return false;
    }
  }

  /**
   * Testa conexão SMTP
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error: any) {
      logger.error('SMTP connection failed', {
        message: EmailService.getErrorMessage(error)
      });
      return false;
    }
  }

  /**
   * Verifica se deve enviar email
   */
  private shouldSendEmail(result: AgentResult): boolean {
    // Sempre enviar se houver erro
    if (result.status === 'failed') {
      return true;
    }

    // Enviar apenas se houver findings (se configurado)
    if (this.config.sendOnlyOnFindings) {
      return result.findings.length > 0;
    }

    // Enviar sempre
    return true;
  }

  /**
   * Constrói assunto do email
   */
  private buildSubject(agentName: string, result: AgentResult): string {
    const status = result.status === 'completed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    const critical = result.findings.filter(f => f.severity === 'critical').length;
    
    if (critical > 0) {
      return `🚨 ${status} ${agentName} - ${critical} Crítico(s) Detectado(s)`;
    }

    if (result.findings.length > 0) {
      return `⚠️ ${status} ${agentName} - ${result.findings.length} Descoberta(s)`;
    }

    return `${status} ${agentName} - Tudo Normal`;
  }

  /**
   * Constrói HTML do email
   */
  private buildEmailHTML(
    agentName: string,
    result: AgentResult,
    executionId: string
  ): string {
    const statusIcon = result.status === 'completed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
    const statusText = result.status === 'completed' ? 'Sucesso' : result.status === 'failed' ? 'Falha' : 'Parcial';
    
    const critical = result.findings.filter(f => f.severity === 'critical');
    const high = result.findings.filter(f => f.severity === 'high');
    const medium = result.findings.filter(f => f.severity === 'medium');
    const low = result.findings.filter(f => f.severity === 'low');

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 20px;
        }
        .header h1 { margin: 0 0 10px 0; font-size: 24px; }
        .header p { margin: 5px 0; opacity: 0.9; }
        .metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }
        .metric {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .metric h3 {
            font-size: 12px;
            color: #666;
            margin: 0 0 5px 0;
        }
        .metric p {
            font-size: 28px;
            font-weight: bold;
            margin: 0;
            color: #333;
        }
        .alert {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .alert.critical {
            background: #f8d7da;
            border-left-color: #dc3545;
        }
        .findings {
            margin: 20px 0;
        }
        .finding {
            background: white;
            border: 1px solid #ddd;
            border-left: 4px solid #666;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .finding.critical { border-left-color: #dc3545; }
        .finding.high { border-left-color: #fd7e14; }
        .finding.medium { border-left-color: #ffc107; }
        .finding h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
        }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
            margin-right: 5px;
        }
        .badge.critical { background: #dc3545; color: white; }
        .badge.high { background: #fd7e14; color: white; }
        .badge.medium { background: #ffc107; color: #000; }
        .badge.low { background: #28a745; color: white; }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${statusIcon} ${agentName}</h1>
        <p><strong>Status:</strong> ${statusText}</p>
        <p><strong>ID:</strong> ${executionId.slice(0, 8)}</p>
        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
    </div>

    <div class="metrics">
        <div class="metric">
            <h3>Findings</h3>
            <p>${result.metrics.findingsCount}</p>
        </div>
        <div class="metric">
            <h3>Ações Geradas</h3>
            <p>${result.actions.length}</p>
        </div>
        <div class="metric">
            <h3>Críticos</h3>
            <p style="color: #dc3545;">${critical.length}</p>
        </div>
        <div class="metric">
            <h3>Altos</h3>
            <p style="color: #fd7e14;">${high.length}</p>
        </div>
    </div>

    ${critical.length > 0 ? `
        <div class="alert critical">
            <strong>⚠️ Atenção:</strong> ${critical.length} descoberta(s) crítica(s) detectada(s). 
            Ação imediata recomendada.
        </div>
    ` : ''}

    ${result.findings.length > 0 ? `
        <div class="findings">
            <h2>🔍 Principais Descobertas:</h2>
            ${critical.slice(0, 3).map(f => `
                <div class="finding critical">
                    <span class="badge critical">CRÍTICO</span>
                    <h3>${f.title}</h3>
                    <p>${f.description}</p>
                </div>
            `).join('')}
            ${high.slice(0, 2).map(f => `
                <div class="finding high">
                    <span class="badge high">ALTO</span>
                    <h3>${f.title}</h3>
                    <p>${f.description}</p>
                </div>
            `).join('')}
        </div>
    ` : `
        <div class="alert">
            <strong>✅ Tudo normal!</strong> Nenhuma anomalia detectada nesta análise.
        </div>
    `}

    <center>
        <p><strong>📎 Relatório completo em PDF anexado</strong></p>
        <p style="font-size: 12px; color: #666;">
            Abra o arquivo PDF anexado para ver o relatório detalhado com todas as descobertas,
            evidências e recomendações.
        </p>
    </center>

    <div class="footer">
        <p><strong>SafeBox Security AI v1.2</strong></p>
        <p>Sistema Inteligente de Análise de Segurança</p>
        <p>Este é um email automático. Para mais informações, consulte o relatório em PDF.</p>
    </div>
</body>
</html>
    `.trim();
  }

  /**
   * Constrói HTML para alerta crítico
   */
  private buildCriticalAlertHTML(
    agentName: string,
    criticalFindings: any[]
  ): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .alert-header {
            background: #dc3545;
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 8px;
        }
        .finding {
            background: #fff;
            border: 2px solid #dc3545;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="alert-header">
        <h1>🚨 ALERTA CRÍTICO</h1>
        <h2>${agentName}</h2>
        <p>${criticalFindings.length} problema(s) crítico(s) detectado(s)</p>
    </div>

    <h3>Ações Urgentes Necessárias:</h3>
    ${criticalFindings.map(f => `
        <div class="finding">
            <h4>${f.title}</h4>
            <p>${f.description}</p>
            <p><strong>Recomendações:</strong></p>
            <ul>
                ${f.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
            </ul>
        </div>
    `).join('')}

    <p style="text-align: center; margin-top: 30px;">
        <strong>Relatório completo será enviado em breve.</strong>
    </p>
</body>
</html>
    `.trim();
  }

  /**
   * Traduz nome do agente
   */
  private getAgentName(agentType: AgentType): string {
    const names: Record<AgentType, string> = {
      audit: 'Análise de Auditoria',
      health: 'Monitoramento de Saúde',
      compliance: 'Verificação de Conformidade',
      breach: 'Detecção de Comprometimento'
    };
    return names[agentType];
  }
}

