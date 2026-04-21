# iOS Workspace (bootstrap)

Esta pasta concentra artefatos da trilha iOS.

- `SafeBoxCore/`: Swift Package com o nucleo de criptografia e testes de paridade.

## Proximo passo (E4.2/E4.3)

- Provider Argon2 real ja integrado via target C interno `CArgon2` com a implementacao de referencia `libargon2`.
- Rodar paridade crypto normal:

```bash
cd ios/SafeBoxCore
swift test
```

- Rodar vetor ULTRA/slow antes de release ou mudanca no KDF:

```bash
cd ios/SafeBoxCore
SAFEBOX_RUN_SLOW_ARGON2_TESTS=1 swift test --filter KDFPipelineTests/testLibArgon2MatchesSlowKDFVectorsWhenEnabled
```

- Criar projeto Xcode com targets:
  - `SafeBoxApp`
  - `SafeBoxAutoFillExtension`
- Conectar `SafeBoxCore` aos targets acima.
