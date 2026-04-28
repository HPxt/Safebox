# E10 - Release Candidate and Xcode Cloud Gate

## Objetivo

Transformar o trabalho E0-E9 em um release candidate testavel em device real antes de TestFlight/App Store.

## Gate local antes do Mac

Rodar e anexar resultado:

```powershell
npm test
npm run build
npm run lint:backend
npm run typecheck:backend
npm audit --omit=dev
npm run ios:static-gate
```

## Gate Xcode Cloud/Mac

1. `swift test --package-path ios/SafeBoxCore`
2. `xcodegen generate` em `ios/SafeBoxApp`
3. Build Debug host + AutoFill extension
4. Build Release host + AutoFill extension
5. Archive para App Store Connect/TestFlight
6. Smoke test em device fisico:
   - login normal;
   - unlock com senha-mestra;
   - ativar/desativar biometria;
   - lock por background;
   - privacy shield no app switcher;
   - leitura de vault;
   - nomes de folders;
   - AutoFill aparece nas configuracoes;
   - Safari solicita AutoFill e a extensao falha fechada quando bloqueada.

## App Review readiness

- Demo account funcional, email confirmado e sem 2FA.
- Vault demo com 3-5 itens falsos.
- Notas de review em ingles explicando login, master password e AutoFill.
- Privacy Policy e Support URL online.
- AASA validado sem redirect.
- Export compliance respondido.

## React Scripts / CRA

As vulnerabilidades dev herdadas de `react-scripts` nao afetam `npm audit --omit=dev`, mas devem virar tarefa propria antes de escala maior:

- criar branch separada;
- avaliar migracao CRA -> Vite ou equivalente;
- preservar rotas, env vars, build Vercel e testes;
- rodar `npm test`, `npm run build`, `npm audit --omit=dev` e audit completo;
- so substituir se o build ficar identico ou melhor.

## Criterio de aceite

- Gate local passa.
- Gate Mac passa.
- Zero crash no TestFlight interno.
- Nenhuma pendencia de capability, privacy manifest, export compliance ou demo account.
