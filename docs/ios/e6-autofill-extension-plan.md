# Etapa 6 - AutoFill Extension Plan

## 1) Objetivo da E6

- Criar a AutoFill Credential Provider Extension para iOS.
- Preparar estrutura, target e contratos no repositório.
- Deixar validacao funcional real de AutoFill para gate futuro em Mac/device.

## 2) Escopo v1

### Dentro do escopo

- target `SafeBoxAutoFillExtension` no projeto iOS;
- controller baseado em `ASCredentialProviderViewController`;
- `DomainMatcher` testavel no core;
- contrato de shared storage via App Group;
- extensao estritamente read-only;
- fallback amigavel quando cofre estiver bloqueado/indisponivel;
- planejamento de `ASCredentialIdentityStore` no host app (doacao/remocao de identidades).

### Fora do escopo

- criar/editar credenciais dentro da extensao;
- persistir plaintext do vault no App Group;
- validar Safari/device no Windows;
- rotacao de senha-mestra via extensao.

## 3) Decisoes de seguranca

- extensao nao grava vault;
- extensao nao persiste plaintext;
- App Group armazena apenas indice minimo e estado seguro necessario ao AutoFill;
- sem logs sensiveis (username completo, senha, token, chave, plaintext);
- limpeza de estado sensivel ao finalizar/cancelar requests;
- erro amigavel quando cofre indisponivel, sem expor detalhes internos.

## 4) Gates

### Gate Windows (fechamento condicional)

- estrutura da extensao criada;
- `project.yml` atualizado com target de extensao;
- testes de `DomainMatcher` passando;
- `swift test` no `ios/SafeBoxCore` passando.

### Gate Mac futuro (encerramento oficial)

- `xcodegen generate`;
- build host + extensao;
- habilitar AutoFill no device;
- testar Safari com dominio elegivel;
- validar entitlements em runtime;
- validar fluxo com demo account.

## 5) Checklist de saida E6

- E6.A target/estrutura;
- E6.B controller minimo;
- E6.C shared storage contract;
- E6.D domain matching;
- E6.E gates documentados.

## 6) Riscos de App Review

- entitlements inconsistentes entre host e extensao;
- extensao sem comportamento claro de erro quando cofre bloqueado;
- vazamento de dados por logs ou persistencia indevida;
- falta de doacao/remocao de identidades (`ASCredentialIdentityStore`) degradando sugestoes de AutoFill.

## 7) Regras operacionais da etapa

- nao commitar/push antes da validacao externa;
- nao alterar arquivos fora do escopo E6;
- se surgir duvida de seguranca, parar e pedir decisao;
- nao afirmar validacao de runtime da extensao sem gate Mac/device.
