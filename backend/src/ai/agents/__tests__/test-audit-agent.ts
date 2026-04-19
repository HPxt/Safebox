/**
 * Teste Básico do Audit Agent
 * 
 * Para executar: npm run test:audit
 */

import { AuditAgent } from '../AuditAgent';
import { AgentConfig, AgentAutomationLevel } from '../../types';
import { logger } from '../../../utils/logger';

// Dados de teste simulados
const mockLogs = [
  // Tentativas de login com falha (padrão suspeito)
  {
    timestamp: new Date('2025-01-06T10:00:00Z'),
    action: 'login_attempt',
    status: 401,
    userId: 'user123',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  {
    timestamp: new Date('2025-01-06T10:00:05Z'),
    action: 'login_attempt',
    status: 401,
    userId: 'user123',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  {
    timestamp: new Date('2025-01-06T10:00:10Z'),
    action: 'login_attempt',
    status: 401,
    userId: 'user123',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  {
    timestamp: new Date('2025-01-06T10:00:15Z'),
    action: 'login_attempt',
    status: 401,
    userId: 'user123',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  {
    timestamp: new Date('2025-01-06T10:00:20Z'),
    action: 'login_attempt',
    status: 401,
    userId: 'user123',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },
  
  // Login bem-sucedido após várias falhas
  {
    timestamp: new Date('2025-01-06T10:00:25Z'),
    action: 'login_success',
    status: 200,
    userId: 'user123',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0'
  },

  // Acesso a múltiplos vaults em sequência rápida (potencial exfiltração)
  {
    timestamp: new Date('2025-01-06T10:01:00Z'),
    action: 'vault_access',
    resource: 'vault_1',
    status: 200,
    userId: 'user123'
  },
  {
    timestamp: new Date('2025-01-06T10:01:02Z'),
    action: 'vault_access',
    resource: 'vault_2',
    status: 200,
    userId: 'user123'
  },
  {
    timestamp: new Date('2025-01-06T10:01:04Z'),
    action: 'vault_access',
    resource: 'vault_3',
    status: 200,
    userId: 'user123'
  },
  {
    timestamp: new Date('2025-01-06T10:01:06Z'),
    action: 'vault_access',
    resource: 'vault_4',
    status: 200,
    userId: 'user123'
  },
  {
    timestamp: new Date('2025-01-06T10:01:08Z'),
    action: 'vault_access',
    resource: 'vault_5',
    status: 200,
    userId: 'user123'
  },

  // Acesso fora do horário normal (3h da manhã)
  {
    timestamp: new Date('2025-01-06T03:00:00Z'),
    action: 'vault_access',
    resource: 'vault_sensitive',
    status: 200,
    userId: 'user456'
  },

  // Erro 500 consecutivos
  {
    timestamp: new Date('2025-01-06T11:00:00Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/vault/list',
    status: 500,
    userId: 'user789'
  },
  {
    timestamp: new Date('2025-01-06T11:00:01Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/vault/list',
    status: 500,
    userId: 'user789'
  },
  {
    timestamp: new Date('2025-01-06T11:00:02Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/vault/list',
    status: 500,
    userId: 'user789'
  },
  {
    timestamp: new Date('2025-01-06T11:00:03Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/vault/list',
    status: 500,
    userId: 'user789'
  },
  {
    timestamp: new Date('2025-01-06T11:00:04Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/vault/list',
    status: 500,
    userId: 'user789'
  },

  // Varredura de endpoints (potencial ataque)
  {
    timestamp: new Date('2025-01-06T12:00:00Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/admin',
    status: 404,
    ip: '10.0.0.50'
  },
  {
    timestamp: new Date('2025-01-06T12:00:01Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/config',
    status: 404,
    ip: '10.0.0.50'
  },
  {
    timestamp: new Date('2025-01-06T12:00:02Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/.env',
    status: 404,
    ip: '10.0.0.50'
  },
  {
    timestamp: new Date('2025-01-06T12:00:03Z'),
    action: 'api_request',
    method: 'GET',
    path: '/api/backup',
    status: 404,
    ip: '10.0.0.50'
  }
];

async function testAuditAgent() {
  console.log('\n🔍 TESTE DO AUDIT AGENT\n');
  console.log('='.repeat(50));

  try {
    // 1. Criar agente com configuração de teste
    const config: Partial<AgentConfig> = {
      enabled: true,
      automationLevel: AgentAutomationLevel.PARTIAL_AUTOMATION,
      maxRetries: 2,
      timeout: 120 // 2 minutos
    };

    console.log('\n1️⃣  Inicializando Audit Agent...');
    const auditAgent = new AuditAgent(config);
    console.log('✅ Agent inicializado');

    // 2. Preparar input
    console.log('\n2️⃣  Preparando dados de teste...');
    const input = {
      logs: mockLogs,
      timeRange: {
        start: new Date('2025-01-06T00:00:00Z'),
        end: new Date('2025-01-06T23:59:59Z')
      },
      focusAreas: ['authentication', 'vault_access', 'suspicious_patterns'] as any
    };
    console.log(`✅ ${mockLogs.length} logs preparados`);

    // 3. Executar análise
    console.log('\n3️⃣  Executando análise de auditoria...');
    console.log('⚠️  NOTA: Requer LM Studio rodando em http://localhost:1234');
    console.log('⏳ Aguardando resposta da IA...\n');

    const result = await auditAgent.analyze(input);

    // 4. Exibir resultados
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESULTADOS DA ANÁLISE');
    console.log('='.repeat(50));

    console.log(`\n🆔 Execution ID: ${result.executionId}`);
    console.log(`📅 Timestamp: ${result.timestamp.toISOString()}`);
    console.log(`✅ Status: ${result.status}`);

    console.log(`\n📈 MÉTRICAS:`);
    console.log(`   - Logs analisados: ${result.metrics.logsAnalyzed}`);
    console.log(`   - Findings encontrados: ${result.metrics.findingsCount}`);
    console.log(`   - Findings críticos: ${result.metrics.criticalFindings}`);
    console.log(`   - Tempo de execução: ${result.metrics.executionTime}ms`);

    if (result.findings.length > 0) {
      console.log(`\n🔍 FINDINGS:`);
      result.findings.forEach((finding, index) => {
        console.log(`\n   ${index + 1}. ${finding.title}`);
        console.log(`      Severidade: ${finding.severity}`);
        console.log(`      Categoria: ${finding.category}`);
        console.log(`      Descrição: ${finding.description?.substring(0, 100) || 'N/A'}${finding.description?.length > 100 ? '...' : ''}`);
        console.log(`      Recursos afetados: ${finding.affectedResources?.join(', ') || 'N/A'}`);
        console.log(`      Recomendações: ${finding.recommendations?.join('; ') || 'N/A'}`);
      });
    }

    if (result.actions.length > 0) {
      console.log(`\n⚡ AÇÕES GERADAS:`);
      result.actions.forEach((action, index) => {
        const automated = action.automated ? '🤖 Automática' : '👤 Manual';
        const approval = action.requiresApproval ? '⚠️  Requer aprovação' : '✅ Sem aprovação';
        console.log(`\n   ${index + 1}. [${action.type}] ${automated} ${approval}`);
        console.log(`      ${action.description}`);
        console.log(`      Prioridade: ${action.priority}`);
      });
    }

    console.log(`\n📝 RESUMO:`);
    console.log(result.summary);

    console.log('\n' + '='.repeat(50));
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!');
    console.log('='.repeat(50));

    // 5. Informar sobre relatórios gerados
    console.log('\n📄 Relatórios gerados em:');
    console.log('   - backend/reports/audit/[timestamp]/');
    console.log('   - Verifique os arquivos .md, .html, .json e .pdf');
    console.log('   - Email enviado para: hppeixoto14@gmail.com');

  } catch (error: any) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);

    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error('\n⚠️  POSSÍVEL CAUSA: LM Studio não está rodando');
      console.error('   Inicie o LM Studio em http://localhost:1234');
      console.error('   Carregue o modelo GPT OSS 20B');
      console.error('   Tente novamente');
    }

    process.exit(1);
  }
}

// Executar teste
if (require.main === module) {
  testAuditAgent()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro fatal:', error);
      process.exit(1);
    });
}

export { testAuditAgent };

