import { supabase } from '../config/database'

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : 'Unknown script error'
)

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')
  
  try {
    // Test basic connection with a simple query
    const { error } = await supabase
      .from('credentials')
      .select('id')
      .limit(1)

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Connection failed:', error.message)
      return false
    }

    console.log('✅ Supabase connection successful!')
    return true
  } catch (error) {
    console.error('❌ Connection error:', getErrorMessage(error))
    return false
  }
}

async function testDatabaseSchema() {
  console.log('🔍 Testing database schema...')
  
  const tables = [
    'credentials', 
    'categories',
    'user_settings',
    'audit_logs',
    'user_sessions',
    'credential_backups'
  ]

  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error) {
        console.error(`❌ Table '${table}' not accessible:`, error.message)
        return false
      }

      console.log(`✅ Table '${table}' accessible`)
    } catch (error) {
      console.error(`❌ Error testing table '${table}':`, getErrorMessage(error))
      return false
    }
  }

  return true
}

async function testRPCFunctions() {
  console.log('🔍 Testing RPC functions...')
  
  const functions = [
    'log_audit_event',
    'get_user_stats',
    'cleanup_expired_sessions',
    'cleanup_old_audit_logs'
  ]

  for (const func of functions) {
    try {
      // Test if function exists (will fail with parameter error if exists)
      const { error } = await supabase.rpc(func)
      
      if (error) {
        // If error mentions missing parameters, function exists
        if (error.message.includes('missing') || error.message.includes('required') || error.message.includes('parameter')) {
          console.log(`✅ Function '${func}' accessible`)
        } else {
          console.error(`❌ Function '${func}' not accessible:`, error.message)
          return false
        }
      } else {
        console.log(`✅ Function '${func}' accessible`)
      }
    } catch (error) {
      console.error(`❌ Error testing function '${func}':`, getErrorMessage(error))
      return false
    }
  }

  return true
}

async function testRowLevelSecurity() {
  console.log('🔍 Testing Row Level Security...')
  
  try {
    // Try to access credentials table without authentication (should fail)
    const { error } = await supabase
      .from('credentials')
      .select('*')

    if (!error) {
      console.warn('⚠️  RLS might not be properly configured - credentials table accessible without auth')
    } else {
      console.log('✅ RLS working - credentials table protected')
    }

    return true
  } catch (error) {
    console.error('❌ Error testing RLS:', getErrorMessage(error))
    return false
  }
}

async function runAllTests() {
  console.log('🚀 Starting Supabase integration tests...\n')
  
  const tests = [
    { name: 'Connection', test: testSupabaseConnection },
    { name: 'Database Schema', test: testDatabaseSchema },
    { name: 'RPC Functions', test: testRPCFunctions },
    { name: 'Row Level Security', test: testRowLevelSecurity }
  ]

  let allPassed = true

  for (const { name, test } of tests) {
    console.log(`\n--- ${name} Test ---`)
    const passed = await test()
    if (!passed) {
      allPassed = false
    }
  }

  console.log('\n' + '='.repeat(50))
  if (allPassed) {
    console.log('🎉 All tests passed! Supabase integration is ready.')
  } else {
    console.log('❌ Some tests failed. Please check the configuration.')
  }
  console.log('='.repeat(50))

  return allPassed
}

// Run tests if called directly
if (require.main === module) {
  runAllTests()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((error) => {
      console.error('Fatal error:', getErrorMessage(error))
      process.exit(1)
    })
}

export { runAllTests, testSupabaseConnection } 
