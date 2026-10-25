# Control Vault - Troca da ANP por litragem da bomba e correção do histórico

Data: 2026-10-25
Status: Planejado, aguardando implementação e CI; sem alterações de produção.
Spec: [2026-10-25-control-vault-manual-liters-and-empty-anchor.md](../specs/2026-10-25-control-vault-manual-liters-and-empty-anchor.md)

## Roteamento e precauções

- Rota recomendada por `MODEL_ROUTING.md`: Sol / esforço extra alto (consumo, persistência e sincronização). Ambiente não expõe troca de modelo/effort, portanto não declarar roteamento aplicado.
- Superpowers: systematic-debugging, test-driven-development, executing-plans e verification-before-completion. Ponytail full, sem novos pacotes.
- Fazer commits separados por tarefas. Executar `npm test` + `npm run build`, inspecionar CI. PR sem merge e sem deploy até autorização.
- Consultar changelog/documentação Supabase e security advisors antes de aplicar migration remota. Não executar SQL de correção nos registros pessoais.
- Estado de produção: `vehicle_state.tank_capacity_liters = 3.000` L no Supabase e o usuário reporta 3,5 L. Corrigir pelo fluxo de Configurações separadamente, preservando a sincronização local-first.

## Tarefa 1 - Tests de domínio para volume real e preço/L (Sol extra alto)

Arquivos:
- `src/modules/vehicle/domain/types.ts`
- `src/modules/vehicle/domain/consumption.ts`
- `src/modules/vehicle/domain/fuelEstimate.ts`
- `src/modules/vehicle/domain/domain.test.ts`
- `src/modules/vehicle/selectors.ts` e `selectors.test.ts`

Interfaces:
- `FuelEntry.liters: number | null`: litros efetivos medidos pelo usuário.
- `effectiveFuelLiters(entry: FuelEntry): number | null`: retorna `entry.liters ?? entry.estimatedLiters`, sem arredondamento extra.
- `lastMeasuredFuelPricePerLiter(entries: FuelEntry[]): number | null`: seleciona a última entrada não excluída com volume medido positivo e divide `amountCents / 100 / liters` (preço derivado, nunca persistido).
- Ambos os métodos de cálculo atuais (`buildConsumptionCycles`, `estimateFuelRemaining`) passam a usar volume operacional efetivo sem contar litros duas vezes. Atualizar fixtures tipadas do projeto para `liters: null`.

Testes primeiro:
- Medição de 0,910 L prevalece sobre `estimatedLiters = 0.993`.
- Legado sem medição continua calculável com `estimatedLiters`, mas sem afirmar ser medido.
- Preço de 700 centavos / 0,910 L é arredondado APENAS para exibição: 7,69 R$/L.
- Entrada excluída e entrada com litro null não definem preço atual.
- Mesmo com litros reais, sem âncora de tanque nem consumo conhecido não inventar autonomia.

## Tarefa 2 - Persistência e sync do campo `liters` já existente (Sol extra alto)

Arquivos:
- `src/infrastructure/sync/sync.ts` e `sync.test.ts`
- `src/infrastructure/local/store.ts` e testes de store pertinentes.

O Supabase já tem `public.fuel_entries.liters numeric(7,3)` herdado do schema inicial; NÃO criar coluna duplicada. Adicionar esse campo aos tipos RemoteFuelEntry, `toRemoteFuelEntry` e `fromRemoteFuelEntry`, preservando id/createdAt/updatedAt/deletedAt. IndexedDB armazena objeto e não requer alteração de schema apenas para propriedade nova.

Testes primeiro:
- roundtrip de 0,91 no mapeamento e em local/remote;
- refresh remoto de legados `liters: null`, independentemente de `estimated_liters`;
- gravações offline pendentes e sync idempotente por ID;
- merges não substituem medição local pendente por cópia remota antiga.

## Tarefa 3 - Formulário e ações de abastecimento offline sem ANP (Sol médio com revisão extra alto)

Arquivos:
- `src/modules/vehicle/FuelView.tsx`
- `src/modules/vehicle/vehicleActions.ts`
- `src/modules/vehicle/inputFormatters.ts` e testes
- `src/modules/vehicle/vehicleActions.test.ts`, `vehicleActions.integration.test.ts`, `vehicleViews.test.tsx`
- Substituir `fuelPriceViews.integration.test.tsx` pelos casos sem rede com litros digitados.

Interfaces:
- `FuelInput = { odometerKm: number; amountCents: number; liters: number; fullTank: boolean; fueledAt: string }`.
- `FuelEditInput` mantém demais campos e `liters: number | null`, permitindo que registros legados permaneçam sem valor medido.
- `recordFuel` exige litro >0, finito, até 3 decimais e não maior que a capacidade nominal configurada; não importa nem chama `getFuelPriceReference`; grava `liters`, `estimatedLiters: null`, campos reference nulos. Manter guardas de odômetro e duplicidade.
- `updateFuelEntry` altera `liters` quando fornecido, preservando referência histórica e `estimatedLiters`; editar legado sem litros não transforma estimativa em medição.
- Acrescentar campo de máscara simples `Litros` com vírgula visual e parsing determinístico (0,910), dentro do padrão visual atual. Mostrar `Preço por litro` derivado após preencher valor/litros.

Testes primeiro:
- valor 7,00 e 0,910 L grava e mostra 7,69/L;
- sem litros, negativo, zero, excesso, NaN, mais de 3 decimais => invalid;
- edição de registro legado deixa `liters: null` se campo vazio;
- offline sem fetch ANP persiste imediatamente;
- proteção contra submit duplo e confirmação de salto de KM permanecem.

## Tarefa 4 - Remover integração ANP de todas as telas (Sol médio)

Arquivos:
- `src/modules/vehicle/VehicleModule.tsx`
- `src/modules/vehicle/TripsView.tsx`, `TripDetailView.tsx` se a cópia precisar mudar
- `src/infrastructure/fuelPrice/fuelPrice.ts` e testes (remover se ficarem sem consumidores)
- `README.md`, `.env.example`, `public`/docs de deploy onde `VITE_FUEL_PRICE_API_URL` estiver descrita.

Eliminar `subscribeFuelPriceReference` das telas e usar `lastMeasuredFuelPricePerLiter` para os custos futuros de percursos. Manter estimativas de percursos como estimativas de custo e não como gasto real. Atualizar testes de UI para ausência de rede.

Testes primeiro:
- fluxo de abastecimento e rotas de percursos não executam `fetch` relacionado à ANP;
- último preço medido correto mesmo se último abastecimento for legado sem volume medido;
- percursos sem preço medido exibem `Preço indisponível` sem erro.

## Tarefa 5 - Correção de hodômetro manual (Sol extra alto)

Arquivos:
- `src/modules/vehicle/navigation.ts` e `navigation.test.ts`
- `src/modules/vehicle/HistoryView.tsx`
- `src/modules/vehicle/OdometerView.tsx`
- `src/modules/vehicle/VehicleModule.tsx`
- `src/modules/vehicle/vehicleActions.ts`, `domain/odometer.ts`
- `src/infrastructure/local/store.ts` e testes correspondentes.

Interfaces:
- rota `odometer-edit` em `/historico/hodometro/:id/editar`; helper `currentOdometerReadingId()`.
- `saveOdometerCorrection(reading, shouldSave)`: transação IndexedDB readwrite com leituras e abastecimentos; atualizar registro com mesmo ID e syncStatus pendente. Revalidar dentro da transação.
- `updateOdometerReading(existing, input: { readingKm: number; recordedAt: string; tankEmpty: boolean }, now, confirmSuspicious?)`: valida ID/source/timestamp/ordem temporal contra a timeline sem o evento editado, preserva `createdAt`.
- Formulário reutiliza `OdometerView`, recebendo `entry?: OdometerReading`, e inclui edição de data e hora.

Testes primeiro:
- clicar `Editar` no evento manual vai para ID exato e volta ao Histórico;
- editar evento anterior com km dentro dos vizinhos mantém ordenação e não duplica;
- regressão de odômetro ou avanço além do próximo evento é rejeitado;
- salto >500 km exige confirmação; validação deve ser refeita atomicamente;
- eventos `fuel_entry` não recebem edição de KM manual.

## Tarefa 6 - Âncora de tanque vazio observada (Sol extra alto)

Arquivos:
- Nova migration versionada `supabase/migrations/<timestamp>_odometer_tank_empty.sql` criada com Supabase CLI após checar `--help`.
- `src/modules/vehicle/domain/types.ts`
- `src/infrastructure/sync/sync.ts`
- `src/modules/vehicle/vehicleActions.ts`
- `src/modules/vehicle/OdometerView.tsx`, `HistoryView.tsx`
- `src/modules/vehicle/domain/fuelEstimate.ts`, `selectors.ts`
- testes de domain, sync, views e integração.

Coluna:
```sql
alter table public.odometer_readings
  add column tank_empty boolean not null default false;
```
Nenhuma política RLS nova é necessária; tabela já tem ownership-RLS e permissões para update. Verificar advisories e documentação atuais antes de produção.

Interfaces:
- `OdometerReading.tankEmpty?: boolean`, com fallback `false` para registros locais legados.
- `recordOdometer`/correção passam esse valor (apenas fonte manual); sync mapeia `tank_empty`.
- `estimateFuelRemaining` recebe leituras manuais e determina a última âncora declarada: cheio = capacidade, vazio = 0. Reprocessa abastecimentos posteriores por timestamp/km, incluindo litros adicionados no mesmo km segundos após `tankEmpty`; clampa em [0, capacidade].
- Na falta de consumo conhecido, informar explicitamente incerteza e não inferir quilômetros de autonomia; no instante exato da âncora de vazio, mostrar 0 L.

Testes primeiro:
- tanque cheio 13352.5 km, leitura de 13590.5 km vazia e abastecimento 3s depois no mesmo km: saldo exatamente 0 imediatamente antes do abastecimento; depois inclui os litros da recarga.
- âncora de tanque cheio posterior invalida âncora vazia anterior;
- empty=false e ausência da propriedade em dados antigos preservam comportamento anterior;
- atualização offline/sync mantém flag, via migration sem perda de IDs;
- nenhuma atualização automática dos dados particulares da base.

## Tarefa 7 - Verificação, migração e liberação (Sol extra alto; revisão independente)

- Rode `npm ci`, `npm test`, `npm run build`; após implementar migração, execute verificações sem tocar dados de produção até autorização.
- Teste regressão de full-to-full, parcial, sem consumo, volume desconhecido legado, autonomia, tombstones, sync offline, correção de histórico e parsing de litro.
- Execute auditoria focada de SQL e segurança/RLS em Supabase via plugin.
- Revise diff completo e CI; use Ponytail full para retirar caminhos ANP mortos e abstrações especulativas.
- Abrir PR funcional separado deste PR de planejamento (ou substituir o conteúdo do ramo antes do PR de implementação, após decisão de fluxo). Não fazer merge nem deploy automático por este plano.
- Após implantação: ajustar capacidade de 3,0 para 3,5 L pelo app em Configurações; editar abastecimento de 25/10 em 13642,6 km para 0,910 L; editar leitura de 13.590,5 km e marcar tanque vazio. Só usuário deve validar dados reais da bomba.
