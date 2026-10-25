# Control Vault - Volume medido, tanque vazio e correção do hodômetro

Data: 2026-10-25
Status: Especificação proposta para implementação; sem merge, deploy ou mutação em dados pessoais.
Repositório: borgescodes/control-vault

## Evidência no código e no banco (somente leitura)

- O formulário `FuelView` recebe `FuelPriceReference`; `recordFuel` calcula `estimatedLiters = amount / precoMedio`; com referência nula grava volume nulo.
- `estimateFuelRemaining` usa âncoras de tanque cheio, somatório das estimativas e consumo médio calibrado. Não possui evento de tanque vazio real; o resultado não representa leitura de sensor.
- `HistoryView` só mostra `Editar`/`Excluir` para abastecimentos. `OdometerView` só cria leituras novas; não há correção de leitura manual.
- Supabase, observado em 2026-10-25: `vehicle_state.tank_capacity_liters = 3.000` L, divergente dos 3.5 L informados pelo proprietário; esta especificação NÃO autoriza atualização silenciosa do dado.
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
- Volume operacional usado em cálculos = `liters ?? estimatedLiters`; volume medido sempre prevalece. Na interface mostrar `0,91 L` sem símbolo de estimativa quando medido, mas `≈ 1,42 L` quando herdado da referência ANP.
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
- Um evento de tanque vazio registrado ANTES de abastecimento constitui âncora exata de 0 L naquele instante. A partir dele, somar somente volumes de abastecimentos posteriores e descontar consumo ao longo da distância, limitando o saldo a [0, capacidade].
- Se um evento de tanque cheio for posterior ao tanque vazio, ele substitui a âncora por capacidade total. Para empate de KM, ordenar por data/hora; eventos de reabastecimento segundos após a leitura de vazio devem ser contabilizados.
- Quando não houver consumo calibrado suficiente, NÃO inventar autonomia. Pode-se indicar nível 0 L exatamente no marco de vazio e ocultar projeções incertas. Distinguir claramente fatos declarados de estimativas.
- O usuário poderá marcar o evento já existente de 13.590,5 km como vazio pela nova edição. NÃO marcar automaticamente nem reescrever o passado.

### 5. Capacidade nominal e segurança operacional

- O banco remoto ainda registra 3,0 L, embora o usuário tenha informado capacidade real de 3,5 L. Deve-se corrigir usando a ação já existente em Configurações, que escreve IndexedDB e sincroniza, em vez de um UPDATE remoto isolado que possa ser sobrescrito.
- Não mudar a capacidade global padrão de outros veículos como efeito colateral.
- Alterações no Supabase só após migração avaliada, com advisories/documentação atualizados; sem DDL de produção nesta fase de desenho.
- Não efetuar merge ou deploy sem verificação e autorização subsequente.

## Critérios de aceitação

1. Abastecimento de 700 centavos e 0,910 L salva localmente sem rede, sincroniza e exibe `0,91 L` + `R$ 7,69/L`.
2. Novo abastecimento sem volume ou com zero/NaN/volume maior que capacidade é rejeitado com mensagem específica.
3. Corrigir valor ou flag de um registro legado sem informar volume medido não transforma `estimated_liters` em medição.
4. Percursos exibem preço derivado da última entrada medida, sem nenhum fetch ANP; em ausência de medida ficam indisponíveis.
5. Corrigir leitura manual de KM no histórico preserva ID, ordenação, validação e sincronização, inclusive offline.
6. Marcar 13.590,5 km vazio produz 0 L nesse instante antes do abastecimento de R$ 10,00 e recalcula o saldo subsequente sem apagar registros.
7. Eventos `fuel_entry` não mostram edição de KM independente; exclusão/edição de abastecimento continuam com as proteções existentes.
8. Todos os testes pertinentes, build e CI passam; revisão independente; nenhuma alteração automática em dados pessoais.

## Limites da medição

A bomba informa litros abastecidos, não litros restantes. O saldo entre eventos ainda será estimado a partir de consumo histórico, mesmo com dados de abastecimento exatos. `Tanque vazio` é uma observação manual, não um sensor contínuo.
