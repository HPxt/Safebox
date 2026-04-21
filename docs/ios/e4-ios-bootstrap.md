# Etapa 4 - iOS Bootstrap (SafeBoxCore)

## Objetivo

Criar um bootstrap iOS minimamente executavel para paridade criptografica com o frontend, reduzindo risco de retrabalho no projeto Xcode da fase seguinte.

## Entregaveis desta etapa

- Modulo Swift Package em `ios/SafeBoxCore`.
- Implementacao base de:
  - `KDFPipeline` (PBKDF2-HMAC-SHA256 + composicao para Argon2id).
  - `LibArgon2Provider` com a implementacao C de referencia `libargon2` vendorizada no target `CArgon2`.
  - `VaultEnvelopeCodec` (AES-256-GCM + `dataHash` do envelope canonico).
  - Contrato `Argon2Providing` para manter a derivacao testavel e desacoplada.
- Testes com vetores oficiais (`test-vectors.json`) cobrindo:
  - hash canonico do envelope;
  - decrypt de vetores AEAD;
  - encrypt AEAD contra vetores web (`encrypted = base64(ciphertext || tag)`);
  - comportamento do pipeline antes da derivacao Argon2;
  - derivacao Argon2id real contra vetores LOW/MEDIUM/HIGH;
  - vetor ULTRA como teste slow opcional.

## Execucao no macOS

No terminal, na raiz do repo:

```bash
cd ios/SafeBoxCore
swift test
```

Para validar tambem o vetor ULTRA (256 MB), rodar explicitamente:

```bash
cd ios/SafeBoxCore
SAFEBOX_RUN_SLOW_ARGON2_TESTS=1 swift test --filter KDFPipelineTests/testLibArgon2MatchesSlowKDFVectorsWhenEnabled
```

## Observacoes de seguranca

- A policy de produto para KDF mobile e sync foi movida para `docs/ios/e5-vault-sync-and-mobile-kdf-policy.md`.
- O provider de Argon2 real usa `libargon2` de referencia com `ARGON2_NO_THREADS`; o parametro `parallelism` continua participando do algoritmo/lane layout, mas o calculo roda sem criar threads nativas.
- O modulo separa claramente:
  - derivacao de chave (KDF),
  - criptografia de envelope,
  - serializacao canonica.
- Isso simplifica auditoria e reduz chance de regressao no protocolo.
