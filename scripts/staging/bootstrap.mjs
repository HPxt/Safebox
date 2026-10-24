import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const projectRef = 'xxynxmktvonnldokhyem'
const workdir = path.join(root, '.staging-work')
const refFile = path.join(workdir, 'supabase/.temp/project-ref')
fs.mkdirSync(path.dirname(refFile), { recursive: true })
if (fs.existsSync(refFile) && fs.readFileSync(refFile, 'utf8').trim() !== projectRef) {
  throw new Error('Unexpected linked project; refusing to continue')
}
fs.writeFileSync(refFile, projectRef)
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const migrations = fs.readdirSync(path.join(root, 'docs/sql/migrations'))
  .filter(name => /^\d{3}_.+\.sql$/.test(name)).sort()
if (migrations.length !== 15) throw new Error('Review the migration list before provisioning')

const sql = [
  'BEGIN; SET LOCAL lock_timeout = \'5s\'; SET LOCAL statement_timeout = \'120s\';',
  `DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public')
       OR EXISTS (SELECT 1 FROM auth.users) THEN
      RAISE EXCEPTION 'Bootstrap is restricted to an empty staging project';
    END IF;
  END $$;`,
  read('database-fixed.sql'),
  read('add-crypto-columns.sql'),
  read('add-credential-types.sql'),
  read('docs/sql/staging-compatibility.sql'),
  ...migrations.map(name => read(`docs/sql/migrations/${name}`)),
  `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
   REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
   GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
   DO $$ DECLARE r record; BEGIN
     FOR r IN SELECT c.conrelid::regclass AS tbl,c.conname FROM pg_constraint c
       JOIN pg_namespace n ON n.oid=c.connamespace
       WHERE n.nspname='public' AND c.contype='c' AND NOT c.convalidated
     LOOP EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',r.tbl,r.conname); END LOOP;
     IF EXISTS (SELECT 1 FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename
       JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname
       WHERE t.schemaname='public' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity)) THEN
       RAISE EXCEPTION 'Every public table must have forced RLS';
     END IF;
   END $$;
   NOTIFY pgrst, 'reload schema'; COMMIT;`,
].join('\n\n')
const output = path.join(workdir, 'bootstrap.sql')
fs.writeFileSync(output, sql)
console.log(`Prepared atomic bootstrap for ${projectRef}: baseline + compatibility + ${migrations.length} hardening migrations`)
if (process.argv.includes('--apply')) {
  const cli = path.join(root, 'node_modules/supabase/bin', process.platform === 'win32' ? 'supabase.exe' : 'supabase')
  const result = spawnSync(cli, ['--workdir', workdir, 'db', 'query', '--linked', '--file', output, '--output', 'json'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    console.error(result.stderr)
    process.exit(result.status || 1)
  }
  console.log('Staging bootstrap committed. No production link was changed.')
}
