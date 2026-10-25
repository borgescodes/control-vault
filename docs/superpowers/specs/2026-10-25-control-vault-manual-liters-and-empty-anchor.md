# Control Vault - Volume medido, tanque vazio e correção do hodômetro

Data: 2026-10-25
Status: Especificação proposta para implementação; sem merge, deploy ou mutação em dados pessoais.
Repositório: borgescodes/control-vault

## Evidência no código e no banco (somente leitura)

- O formulário `FuelView` recebe `FuelPriceReference`; `recordFuel` calcula `estimatedLiters = amount / precoMedio`; com referência nula grava volume nulo.
- `estimateFuelRemaining` usa âncoras de tanque cheio, somatório das estimativas e consumo médio calibrado. Não possui evento de tanque vazio real; o resultado não representa leitura de sensor.
- `HistoryView` só mostra `Editar`/`Excluir` para abastecimentos. `OdometerView` só cria leituras novas; não há correção de leitura manual.
- Supabase, observado em 2026-10-25: `vehicle_state.tank_capacity_liters = 3.000` L. O proprietário confirmou em seguida que **3,0 L é a capacidade real correta**. Nenhuma alteração da capacidade é necessária ou autorizada.
- Registro 2026-10-25, 13.642,6 km, R$ 7,00: `estimated_liters = NULL`. A bomba informou 0,91 L.
- Registro 2026-10-23, 13.590,5 km, R$ 10,00: volume 1,418 L é estimado pela ANP. Houve atualização manual de hodômetro imediatamente ANTES do abastecimento no mesmo km. O usuário informa que nesse marco o tanque havia esvaziado.
- A coluna remota `fuel_entries.liters numeric(7,3)` JÁ existe, atualmente nula nos 12 abastecimentos ativos; `estimated_liters` guarda estimativas históricas. Reutilizar `liters` elimina a necessidade de nova coluna de volume.

## Comportamento aprovado pelo pedido do usuário

### 1. Abastecimento com litragem medida, totalmente independente da ANP

O formulário `Abastecer` solicita três informações obrigatórias: hodômetro, valor pago em centavos e litros efetivamente informados na bomba (máximo de três casas decimais). `Completei o tanque` continua opcional. A data/hora é mantida como hoje.

- Exemplo: valor R$ 7,00 e litragem 0,910 L => preço efetivo R$ 7,692307.../L, exibido como R$ 7,69/L; guardar apenas valor em centavos e volume em litros (não arredondar o preço antes de calcular).
- Não fazer requisições HTTP para referência ANP em NENHUM fluxo (abastecimento, percursos, telas ou tarefas em background).
- O cálculo de custo de percursos deve usar o preço por litro de abastecimento medido mais recente e válido. Se ainda não houver, exibir `Preço indisponível` sem consultar serviço externo.
- Validar que volume é finito, positivo, representável até milésimos e compatível com capacidade configurada. Não bloquear gravação local por falha de rede.
- Retirar env pública `VITE_FUEL_PRICE_API_URL`, assinatura do serviço e textos de referência indisponível da experiência ativa. Código/testes da integração anterior podem ser removidos quando substituídos por cobertura equivalente.

### 2. Histórico e correção sem adulterar dados legados

- Modelo local `FuelEntry` passa a carregar `liters: number | null` com mapeamento exato para `fuel_entries.liters`; `estimatedLiters` e campos de referência ANP permanecem para dados históricos.
- Volume exibido e usado no histórico legado = `liters ?? estimatedLiters`; medição prevalece sobre estimativa. Na interface mostrar `0,91 L` sem símbolo quando medido, mas `≈ 1,42 L` quando herdado da ANP. **A nova calibração, no entanto, usa apenas `liters` medidos: jamais utilizar `estimatedLiters` para formar os novos ciclos de aprendizagem.**
- Ao editar um abastecimento antigo: NÃO preencher o novo campo de litros com uma estimativa como se fosse volume medido. Mostrar a estimativa separadamente, permitir acrescentar um volume confirmado, e preservar os campos legados. Correções de valor/km/fullTank continuam permitidas mesmo sem volume medido, para não bloquear edição do legado.
- Exibir preço/L como valor derivado apenas quando houver volume medido válido; não persistir preço/L como dado independente.
- Preservar IDs, timestamps de criação, sincronização offline, RLS e histórico antigo. Não alterar automaticamente as 12 linhas do usuário.

### 3. Edição de eventos manuais de hodômetro

- Cada evento manual no Histórico ganha botão `Editar`, com rota direta `/historico/hodometro/:id/editar` e navegação de retorno.
- Permitir corrigir quilometragem e data/hora do evento sem criar ID novo; manter `createdAt` e atualizar `updatedAt`. Persistir em IndexedDB primeiro e marcar sincronização pendente, com upsert por ID no Supabase.
- Validar monotonicidade cronológica contra eventos de hodômetro e abastecimento vizinhos (exceto o próprio ID). Permitir KM igual quando legítimo, rejeitar regressões e exigir confirmação para saltos suspeitos segundo a política atual.
- Não permitir editar leituras `source = fuel_entry` como se fossem manuais.

### 4. Registro explícito de tanque vazio

- Adicionar propriedade `tankEmpty: boolean` às leituras de hodômetro manuais, com coluna remota `odometer_readings.tank_empty boolean not null default false` via migration versionada. Registros locais antigos sem propriedade são tratados como `false`.
- No formulário de atualização e correção de KM, oferecer opção `Tanque estava vazio`; no histórico, sinalizar os eventos assim marcados.
- Um evento de tanque vazio registrado ANTES de abastecimento constitui âncora declarada de 0 L naquele instante. A partir dele, o saldo projetado pode somar volumes posteriores e descontar consumo ao longo da distância, limitando a [0, 3,0 L]. Se algum volume posterior for legado estimado, marcar o saldo como **provisório**; esse período NÃO forma um ciclo de consumo medido.
- Se um evento de tanque cheio for posterior ao tanque vazio, ele substitui a âncora por capacidade total. Para empate de KM, ordenar por data/hora; eventos de reabastecimento segundos após a leitura de vazio devem ser contabilizados.
- Quando não houver consumo calibrado suficiente, NÃO inventar autonomia. Pode-se indicar nível 0 L exatamente no marco de vazio e ocultar projeções incertas. Distinguir claramente fatos declarados de estimativas.
- O usuário poderá marcar o evento já existente de 13.590,5 km como vazio pela nova edição. NÃO marcar automaticamente nem reescrever o passado.

### 5. Capacidade nominal e segurança operacional

- **Capacidade confirmada: 3,0 L.** O banco remoto já está correto; não atualizar a capacidade no banco, nas Configurações nem no padrão do app.
- Tratar abastecimentos que supostamente excedam 3,0 L como inconsistentes para revisão do dado informado, nunca alterar a capacidade automaticamente.
- Alterações no Supabase só após migração avaliada, com advisories/documentação atualizados; sem DDL de produção nesta fase de desenho.
- Não efetuar merge ou deploy sem verificação e autorização subsequente.

### 6. Transição conservadora e nova calibração a partir dos volumes medidos

- **Não perder nem reclassificar registros históricos.** Preservar IDs, despesas, datas, odômetro, flags de tanque cheio, `estimatedLiters`, referência ANP e ciclos históricos na tela Histórico. Nenhum reset de IndexedDB/Supabase, nenhuma exclusão em massa, nenhuma migração que substitua os litros estimados por valores supostamente medidos.
- A nova época de calibração começa com o **primeiro abastecimento explicitamente marcado como tanque cheio e que tenha `liters` medidos** após a mudança. Esse evento define 3,0 L no tanque. O abastecimento de 25/10 de 0,910 L pode ter seu registro antigo corrigido com medição confirmada, ajudando no preço/L, mas sozinho NÃO define um tanque cheio nem um ciclo completo.
- Para cada ciclo **medido cheio -> cheio**, considerar somente o intervalo entre a primeira e a próxima marca de tanque cheio, inclusive abastecimentos parciais. O ciclo é elegível apenas se **todos** os volumes adicionados depois da âncora inicial até a recarga final forem medidos (`liters !== null`), com quilômetros monotônicos e `liters > 0`. Volume legado nulo ou estimado no intervalo desqualifica esse ciclo; não imputar, dividir despesa por preço histórico ou presumir tanque cheio.
- Fórmula do consumo medido: `km/L = (odometro_fim - odometro_inicio) / soma(litros_medidos_dos_abastecimentos_no_intervalo)`; incluir o abastecimento final, excluir os litros do abastecimento cheio inicial. Manter a mediana móvel dos últimos até cinco ciclos medidos do método existente; estado `estimado` após 1-2 ciclos, e `calibrado` após pelo menos três ciclos consistentes conforme limite de dispersão já existente.
- Antes de existir um ciclo medido elegível, permitir usar o consumo histórico **apenas como referência provisória sinalizada, de baixa confiança**, para não inutilizar a projeção de autonomia. Não rotular o consumo histórico de `calibrado` na fase de transição. Se não houver sequer dado provisório, exibir `Calibrando` e ocultar autonomia, sem inventar valores.
- Depois do primeiro ciclo medido elegível, cálculo de consumo e autonomia usa **exclusivamente ciclos medidos** para aprender `km/L`. O painel pode mostrar progresso `Nova calibração 1/3, 2/3, 3/3`; dados históricos continuam visíveis, mas não contaminam a média nova. Uma nova marca de tanque cheio redefine o saldo para 3,0 L independentemente da estimativa anterior.
- Uma âncora de tanque vazio observada no passado (por exemplo 13.590,5 km, antes do abastecimento de 1,418 L estimados) melhora a reconstrução do saldo naquela data, mas **não transforma os 1,418 L estimados em medição**, nem deve ser usada para certificar um novo ciclo medido. Ela não substitui a necessidade de uma futura âncora cheia medida.
- A continuidade deve ser automática via IndexedDB + sync existente. O marco da nova calibração é **derivado do histórico de abastecimentos medidos/cheios**, evitando uma configuração global ou um reset de dados.

## Critérios de aceitação

1. Abastecimento de 700 centavos e 0,910 L salva localmente sem rede, sincroniza e exibe `0,91 L` + `R$ 7,69/L`.
2. Novo abastecimento sem volume ou com zero/NaN/volume maior que capacidade é rejeitado com mensagem específica.
3. Corrigir valor ou flag de um registro legado sem informar volume medido não transforma `estimated_liters` em medição.
4. Percursos exibem preço derivado da última entrada medida, sem nenhum fetch ANP; em ausência de medida ficam indisponíveis.
5. Corrigir leitura manual de KM no histórico preserva ID, ordenação, validação e sincronização, inclusive offline.
6. Marcar 13.590,5 km vazio produz 0 L nesse instante antes do abastecimento de R$ 10,00 e recalcula o saldo subsequente sem apagar registros.
7. Eventos `fuel_entry` não mostram edição de KM independente; exclusão/edição de abastecimento continuam com as proteções existentes.
8. Capacidade permanece 3,0 L, sem alteração de `vehicle_state`; não existem instruções de ajuste para 3,5 L.
9. Históricos da ANP continuam disponíveis, inclusive valores e gráficos antigos; o primeiro ciclo de nova calibração começa apenas com tanque cheio medido, e seus litros usados são 100% medidos, sem estimativas legadas.
10. Um ciclo novo de 60 km com 1,5 L de abastecimentos posteriores ao tanque cheio inicial resulta em 40 km/L medidos. A média nova substitui a provisória depois do primeiro ciclo completo.
11. Antes de haver ciclo medido, o painel deixa explícito que o consumo anterior é provisório, com confiança baixa, ou exibe `Calibrando` se não houver consumo anterior.
12. Todos os testes pertinentes, build e CI passam; revisão independente; nenhuma alteração automática em dados pessoais.

## Limites da medição

A bomba informa litros abastecidos, não litros restantes. O saldo entre eventos ainda será projetado a partir do consumo: inicialmente histórico/provisório e, após o primeiro ciclo novo elegível, recalibrado exclusivamente com medições. `Tanque vazio` é uma observação manual, não um sensor contínuo.
