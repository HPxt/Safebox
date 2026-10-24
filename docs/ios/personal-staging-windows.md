# SafeBox Staging no iPhone pelo Windows

Variante de teste pessoal, sem Apple Developer Program e sem TestFlight.
Nao e release de producao nem validacao completa de seguranca do iPhone.

## Separacao e protecoes

- Projeto independente: `project.personal-staging.yml`; target/scheme
  `SafeBoxPersonalStaging`; app `SafeBox Staging`.
- Bundle original `app.safebox.ios.personalstaging`, diferente do app principal.
  A ferramenta local pode ajustar o identificador durante a assinatura.
- Somente Supabase `xxynxmktvonnldokhyem` e backend
  https://safebox-backend-staging.vercel.app . Valores publicos fixos, sem
  incluir `Local.xcconfig`. O codigo desta variante rejeita outros endpoints.
- Sem extensao AutoFill, App Groups, associated domains ou entitlement de
  compartilhamento de Keychain. Publicacao de grants/indice AutoFill compilada
  fora desta variante. Isso desativa um recurso, nao cria fallback inseguro.
- Keychain privado preservado: WhenPasscodeSetThisDeviceOnly,
  biometryCurrentSet, sem sync iCloud e sem access group compartilhado.
  Service propio da variante, diferente do principal. Face ID requer aparelho
  com codigo de bloqueio e biometria configurados; validar no teste fisico.
- AES-GCM/Argon2, verificacao de integridade, controle de versao, HTTPS/ATS,
  sessao em memoria, timeout, relock em background e privacy shield preservados.
- O projeto/entitlements principais nao foram removidos nem substituidos.
  Os guards adicionais so ativam com `SAFEBOX_PERSONAL_STAGING`.

## Como o pacote e gerado

Workflow `iOS Personal Staging IPA`, no PR ou por workflow_dispatch quando
disponivel no branch padrao. Checkout do SHA exato, sem credenciais persistidas,
sem secrets Apple/Supabase, testes no simulador e archive Release para iPhone.

O empacotador verifica Info.plist, ATS, bundle, ambientes, privacy manifest,
Mach-O IOS/arm64 e ausencia de extensoes, provisioning, envs ou chaves privadas.
Gera artifact `safebox-personal-staging-unsigned`, retido por sete dias:

- `SafeBox-Personal-Staging-unsigned.ipa`
- `SafeBox-Personal-Staging-unsigned.ipa.sha256`
- `validation.json`, com SHA de origem e resultado da inspecao.

O IPA ainda NAO instala por tocar nele: precisa ser assinado localmente com
sua conta pessoal. Nao se envia senha Apple, 2FA, recovery code ou certificados
ao chat, repositorio ou CI. Nao usar certificados empresariais de terceiros,
sites de assinatura ou desativar 2FA/ATS para contornar uma falha.

## Instalacao pelo Windows

1. Baixar o artifact do workflow aprovado no repositorio HPxt/Safebox e
   extrair o ZIP. Conferir `validation.json` e o hash antes de assinar:

   ```powershell
   Get-FileHash .\SafeBox-Personal-Staging-unsigned.ipa -Algorithm SHA256
   Get-Content .\SafeBox-Personal-Staging-unsigned.ipa.sha256
   ```

2. Instalar AltServer/AltStore CLASSIC somente pelo site oficial. Seguir o
   guia Windows para os componentes Apple, conectar iPhone por USB, desbloquear
   e confirmar que confia neste computador. Nao confundir com AltStore PAL.
3. Fazer a autenticacao Apple apenas na ferramenta local oficial. Ela participa
   da assinatura: e uma dependencia externa sensivel, nao uma garantia dada
   por este projeto. Confira procedencia e prompts antes de continuar.
4. Instalar e abrir AltStore no iPhone. Se solicitado, confiar no perfil da
   propria conta em Ajustes > Geral > VPN e Gerenciamento de Dispositivo.
   Habilitar Modo de Desenvolvedor em Privacidade e Seguranca, com reinicio,
   quando solicitado pelo sistema. Nao fazer jailbreak.
5. Transferir SOMENTE o IPA ao app Arquivos do iPhone e importa-lo na opcao de
   adicionar IPA do AltStore Classic, mantendo AltServer acessivel. A conta e
   assinatura sao locais. Nao transferir envs nem o fixture de credenciais.
6. Abrir `SafeBox Staging`. Se houver erro de assinatura/capability, registrar
   a mensagem sem mostrar senhas. Nao desabilitar protecoes do app principal.

Conta gratuita tem prazo curto (normalmente sete dias) e limite de apps/IDs.
O prazo do artifact no GitHub NAO e o prazo da assinatura local. Renovar pelo
AltStore conforme seu guia; nunca usar este fluxo para cofre/dados reais.
Compatibilidade final do re-signing precisa ser confirmada no seu aparelho.

## Conta ficticia e roteiro manual

Uma conta persistente exclusivamente de staging pode ser preparada localmente:

```powershell
node scripts/staging/device-account.mjs create
```

As credenciais ficam so em `.staging-work/iphone-test-account.json`, ignorado
pelo Git. `loginPassword` e a senha de login; `masterPassword` desbloqueia o
cofre. Ler localmente e digitar no aparelho; nao enviar screenshot/arquivo.
Essa conta nao e removida automaticamente nem expira quando o IPA expira.
Revisar em sete dias e remover apos o teste:

```powershell
node scripts/staging/device-account.mjs delete
```

O script cria salt e senhas aleatorios, deriva a chave localmente e grava
perfil/ciphertext pelo backend com o token do usuario. Service-role fica no
processo administrativo local para criar/remover a conta, nunca no IPA.

Preencher os resultados abaixo somente apos executar no iPhone:

| Etapa | Esperado | Resultado fisico |
|---|---|---|
| Instalacao/abertura | App separado chamado SafeBox Staging | Pendente |
| Login com senha errada/correta | Rejeitar errada; correta abre unlock, nao o cofre | Pendente |
| Senha-mestra errada/correta | Rejeitar errada; correta mostra apenas credencial ficticia | Pendente |
| Criar/editar/excluir item ficticio | Persistencia apos relock e novo login | Pendente |
| Bloquear aparelho/trocar de app | Sem plaintext no app switcher; cofre relockado ao voltar | Pendente |
| Face ID | Exige desbloqueio inicial; protecao do Keychain mantida | Pendente |
| Offline/rede intermitente | Erro controlado, sem liberar cofre indevidamente | Pendente |
| Logout e reabrir | Sem sessao/dados do cofre visiveis | Pendente |

AutoFill, dominos associados, compartilhamento entre app/extensao e distribuicao
TestFlight nao estao disponiveis nesta variante. MFA completo e rate limit
distribuido seguem gates separados. Uma instalacao bem-sucedida nao os valida.

## Fontes

- https://developer.apple.com/help/account/basics/about-your-developer-account
- https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device/
- https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows
- https://faq.altstore.io/altstore-classic/your-altstore
