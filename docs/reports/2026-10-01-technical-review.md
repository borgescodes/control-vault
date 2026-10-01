# Revisão técnica — Control Vault

Data: 01/10/2026. Branch: `codex/reliability-corrections`.

As correções estão implementadas e verificadas localmente. Esta revisão não publicou o aplicativo, não alterou registros pessoais no servidor e não mudou schema, Auth ou RLS. O favicon e os ícones/logo fornecidos pelo usuário foram preservados.

## Causas e correções

| Problema | Evidência no código ou reprodução | Correção |
| --- | --- | --- |
| Dispositivos permaneciam com históricos diferentes | A hidratação remota só acontecia quando o banco local estava vazio. Um dispositivo com dados antigos deixava de buscar novidades. | Cada sincronização envia pendências e busca todas as linhas do proprietário, em páginas ordenadas de 1.000 registros. A tela recebe notificações após o merge local. |
| Salvamento parecia concluído sem confirmação remota | A gravação local terminava antes da sincronização; falhas não tinham feedback operacional suficiente. | Salvamento informa durabilidade local/pendência. ON exige refresh remoto concluído e fila vazia; OFF indica ausência de rede; SYNC inclui pendência, falha, sincronização ou snapshot ainda não confirmado. Há erro e ação de tentar novamente. |
| Continuidade dependia de uma nova abertura | Faltavam gatilhos de foco/retomada e visibilidade. | Startup/login, gravação, retorno da rede, foco e página novamente visível acionam sincronização; eventos de retomada são agrupados, sem polling periódico. |
| Uma gravação concorrente podia perder o estado pendente | O acknowledgment por ID não verificava se o conteúdo tinha mudado durante o envio. | Só o snapshot efetivamente enviado pode ser marcado como sincronizado. Um novo valor continua pendente. |
| Configuração inicial de outro dispositivo podia sobrescrever a existente | Upsert de configuração permitia atualizar o veículo já confirmado. | Setup remoto insere uma vez por proprietário; um novo dispositivo lê a configuração existente. |
| Acesso local de outra conta após falha de sync | A revisão independente encontrou montagem da tela mesmo após rejeição do proprietário, inclusive offline. | A identidade é validada antes de abrir dados locais. Outra conta é bloqueada sem apagar o banco. |
| Refresh tirava foco do campo; renovação de token desmontava formulário | Efeito de autofocus dependia do objeto completo do veículo; inicialização dependia do objeto de sessão. | Foco muda apenas com prontidão/tela. Renovação da mesma conta preserva formulário e foco. Evento Auth recente prevalece sobre resposta antiga de sessão em cache. |
| Referência de combustível pouco clara | O formulário mostrava o limite calculado, mas não explicitava o preço médio usado para estimar litros. | Mostra preço médio municipal em R$/L, fonte ANP, semana, litros estimados e teto separadamente. |
| Barra inferior deslocava ou sobrepunha conteúdo | A navegação participava do conteúdo/da tela animada. | Barra fixa compartilhada fora das telas animadas, fundo opaco, espaço reservado no conteúdo e safe areas. Oculta durante foco em campos para liberar o formulário. |
| Diálogo não cobria a tela | No Chrome a camada media 354 × 666, começando em (18,78), em viewport 390 × 844. A transformação da tela animada limitava o elemento fixed. | Diálogo renderizado via portal no body, preservando a animação original. Teste exige cobertura de todo o viewport. |
| Voltar do navegador não refletia a tela | Navegação usava estado React sem caminhos/histórico nativo. | History API e popstate em `/`, `/hodometro`, `/abastecer`, `/historico`. Sem predecessor interno, Voltar de uma entrada direta retorna a `/` por replace. |
| Instalação/atualização PWA sem fluxo explícito | Faltavam ação de instalação e integração de registro/atualização com a interface. | Prompt retido de instalação, instruções iOS e atualização somente após clicar em “Atualizar app”. A nova versão espera, preservando o formulário aberto. |

As causas acima foram identificadas no código e/ou reproduzidas. Elas explicam a possibilidade de dados desatualizados e confirmação enganosa. Não é possível atribuir cada incidente passado no celular a uma causa única sem seu log e uma sessão autenticada reproduzível.

## Persistência e sincronização

Supabase representa os registros confirmados entre dispositivos. IndexedDB é a cópia operacional durável, incluindo gravações offline ainda não confirmadas. Não depende de localStorage para armazenar registros de domínio.

O fluxo é: commit local com ID estável → fila pendente → envio idempotente → acknowledgment do snapshot → leitura remota completa → merge transacional → atualização das telas. Uma falha em uma das leituras não aplica um snapshot parcial. Dados remotos substituem registros locais confirmados do mesmo ID, mas não substituem uma gravação local ainda pendente.

Os registros da interface atual são append-only. Não foram criadas telas de edição/exclusão nem propagação de tombstones. O merge não elimina registros apenas por ausência em uma leitura. Isso mantém o escopo aprovado; futura exclusão exigirá contrato próprio.

IndexedDB passa da versão 2 para 3, adicionando `sync_metadata` com vínculo de proprietário. Preserva os registros existentes. Um banco legado é vinculado à primeira conta autenticada que o abre; o histórico legado não tinha identidade suficiente para provar seu proprietário anterior. Troca de conta não apaga dados. Sign-out e expiração também não apagam dados.

Corridas entre gravação/envio, repetição de tentativa e troca de sessão têm cobertura. Diagnósticos de sync registram operação/tabela/código seguro, sem payload ou credenciais.

## Valores e combustível

Valores continuam armazenados como centavos inteiros; os testes das regras e projeções foram mantidos. A estimativa usa a média municipal já prevista no produto. O teto continua sendo 4 L × preço máximo municipal. Exemplo da fixture: média 7,053 aparece como R$ 7,05/L; máximo 7,22 gera teto R$ 28,88. Média e máximo são grandezas distintas.

A gravação offline funciona com a referência semanal em cache. Sem referência disponível, salva o valor e o hodômetro com estimativa nula. Não foram adicionadas despesas, manutenção, impostos, seguro ou módulo financeiro genérico.

## Navegação, layout e PWA

A navegação nativa evita entradas duplicadas para a mesma tela e permite back/forward. O conteúdo reserva espaço para a barra; a barra tem fundo preto e camada própria. Foram verificadas larguras móveis e desktop, rolagem longa, último registro, entrada direta, formulário e confirmação.

O PWA mantém manifest, identidade/scope, ícones fornecidos e fallback de navegação offline. Precache contém apenas shell/assets estáticos; não há runtime cache para Supabase ou respostas de combustível. HTML, manifest e service worker recebem revalidação; assets com hash recebem cache imutável via `public/_headers`.

Worker novo aguarda confirmação. A verificação do worker ocorre também ao retomar/focar/ficar online; nenhuma atualização recarrega automaticamente o formulário. Instalação depende da disponibilidade do evento do navegador; no iOS a interface oferece instruções de adicionar à tela inicial quando fora do modo standalone. Referências: [fluxo de atualização do Vite PWA](https://vite-pwa-org.netlify.app/guide/prompt-for-update), [evento beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event), [headers do Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/headers/).

## Auditoria do servidor

Projeto auditado pelo plugin Supabase: `control-vault` (`zlvabzvosmzapvznemiu`). A URL local foi comparada ao projeto auditado sem imprimir chaves.

- As três tabelas de aplicação têm RLS habilitado e nove políticas de select/insert/update por proprietário. Updates têm USING e WITH CHECK; a condição exige `auth.uid() = user_id`.
- Grants autenticados e colunas foram conferidos. As consultas anônimas diretas às três tabelas retornaram HTTP 401.
- Foi encontrada uma conta e um proprietário dos registros, sem registros órfãos de leitura/abastecimento. No momento da auditoria: um veículo, cinco leituras e dois abastecimentos.
- Advisor de performance sem apontamentos. Advisor de segurança avisou que proteção contra senhas vazadas está desabilitada. Isso não foi tratado como causa de sync nem alterado nesta revisão. [Documentação do aviso](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Logs continham timeouts do serviço PostgREST nas últimas 24 horas. Não havia correlação suficiente para associá-los ao salvamento relatado. Não foi encontrada evidência de bloqueio geral por RLS.

Nenhuma migration remota, política, grant ou configuração Auth foi alterada. Portanto não há migration de servidor nova; a única migração é a evolução local do IndexedDB.

## Verificação

Suite final: **224 testes em 19 arquivos passaram**. Build TypeScript/Vite/PWA concluído. `git diff --check` sem erros.

Teste reproduzível de integração: `tests/browser-reliability.cjs`, sobre o bundle de produção no Chrome, com IndexedDB e service worker reais e Auth/Data API em fixtures isoladas. Nenhum registro sintético foi enviado ao projeto pessoal.

- Contexto móvel salva; segundo contexto com banco local já preenchido recebe a novidade por foco e mantém após reload.
- Salvamento offline permanece após reload servido pelo worker; reconexão envia a fila e outro contexto recebe por retomada.
- Falha HTTP 503 mostra SYNC/erro; retry confirma; nova tentativa não duplica. Contexto privado novo recebe o conjunto confirmado.
- Histórico longo permanece acessível; barra fica fixa e último item não é encoberto em 320, 360, 375, 390, 412, 430 e 1440 px. Sem overflow horizontal.
- Formulário com foco oculta a barra; back nativo e entrada direta foram verificados. Confirmação cobre viewport completo.
- Nova versão real do worker avisa, mantém R$ 12,34 digitados e só ativa/recarrega após clicar na ação de atualização.
- Sem erros de página capturados no navegador.

A revisão independente de toda a branch encontrou duas falhas materiais (acesso de outro proprietário e perda de foco no refresh), corrigidas com regressões. A auditoria adicional reproduziu e corrigiu a camada do diálogo e a perda de formulário na renovação da sessão.

## Arquivos e commits

| Área | Arquivos principais |
| --- | --- |
| Contrato e ordem | `docs/superpowers/specs/2026-10-01-control-vault-reliability-design.md`, `docs/superpowers/plans/2026-10-01-control-vault-reliability.md` |
| Dados/sync | `src/infrastructure/local/db.ts`, `store.ts`, `store.test.ts`; `src/infrastructure/sync/sync.ts`, `sync.test.ts` |
| Sessão/feedback | `src/app/App.tsx`, `App.test.tsx`; `src/shared/ui/ConnectionIndicator.tsx`, `ConnectionIndicator.test.tsx`; `src/modules/vehicle/VehicleModule.tsx` |
| Navegação/combustível | `src/modules/vehicle/navigation.ts`, `navigation.test.ts`, `FuelView.tsx`, `SuspiciousOdometerDialog.tsx`, `vehicleViews.test.tsx`; `src/styles/global.css`; `index.html` |
| PWA | `src/app/PwaControls.tsx`, `PwaControls.test.tsx`; `src/infrastructure/pwa/register.ts`, `register.test.ts`; `src/main.tsx`, `src/vite-env.d.ts`; `vite.config.ts`; `public/_headers` |
| Evidências | `tests/browser-reliability.cjs`, `README.md`, este relatório |

Commits por tarefa: `1e0c7e9` (contrato/plano), `08166de` (merge/sync), `ec53d29` (lifecycle/feedback), `175860e` (navegação/referência), `9b85308` (PWA), seguido do commit de verificação/ajustes finais. A identidade visual anexada está no commit anterior `b94ac59`.

Roteamento recomendado: Sol / Extra high para dados/sync, Sol / Medium para interface/PWA, Astra / Medium para revisão integrada. As recomendações foram reportadas; não foi alegada troca de modelo da sessão principal. O revisor independente utilizou Astra / Medium.

## Limites restantes

As fixtures demonstram o comportamento entre contextos com rede/falhas controladas, não a comunicação autenticada com o servidor pessoal em dois aparelhos físicos. Não havia sessão pessoal utilizável no navegador isolado; a validação live ficou em inspeção e leitura anônima bloqueada. Instalação física Android/iOS, teclado virtual real e atualização na hospedagem publicada precisam de verificação após publicação. Simulação de viewport/foco não substitui essas condições.

Alterações estão na branch local, sem merge ou publicação. O site em produção ainda não recebe estes commits. O aviso de senha vazada continua registrado. Não há garantia sobre histórico de falhas sem telemetria correlacionada, nem confirmação de que um registro ainda pendente num aparelho desligado já esteja no servidor.
