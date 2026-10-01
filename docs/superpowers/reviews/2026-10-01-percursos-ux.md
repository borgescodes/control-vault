# Percursos — refinamento de UX/UI

Data: 2026-10-01. Escopo: frontend e formatters de entrada.

## Auditoria comparativa

HomeView, FuelView, OdometerView, HistoryView, SetupView, VehicleIcon,
VehicleModule, inputFormatters e global.css foram consultados antes das alterações.

| Divergência | Correção |
| --- | --- |
| Navegação com labels e margem de ícone destinada a texto | Só os três SVGs existentes, 24px, botões de 50px, aria-label, aria-current e safe areas |
| Novo duplicado no estado vazio | Uma ação primária Novo no cabeçalho, em todos os estados |
| Copy redundante | Removidos estado vazio explicativo, sufixos total/ida na lista e labels longas do formulário |
| Lista com 82px e duas linhas obrigatórias até 430px | Linhas de 56px, rota flexível e valores compactos; grupos se reorganizam quando necessário |
| Título com overflow-wrap e valores que podiam quebrar | nowrap nas unidades e valores; ellipsis em origem e destino, também no detalhe |
| Detalhe com labels e separadores repetidos | Ida, Volta e Total com valores prioritários; labels de métricas preservadas para leitores de tela; um separador para Consumo/Preço |
| Editar disputando espaço com o título | Editar e Excluir juntos abaixo das métricas, com ações discretas |
| Parsing decimal próprio e texto sem limite | Campo DistanceField compartilhado pelas duas pernas e mecanismo existente do hodômetro |

## Reutilização e limite

Mantidos tokens, fontes, SVGs, cores, motion, reduced motion, view-header,
view-back, vehicle-form, vehicle-toggle, vehicle-form__submit, button-primary,
button-secondary, button-quiet, button-danger e sr-only existentes.

formatDistanceInput reutiliza formatOdometerInput e troca apenas ponto por vírgula.
odometerDigitsFromKm inicializa a edição; parseOdometerKm entrega quilômetros
numéricos, sem alterar a persistência. Ida e volta usam o mesmo DistanceField.

Exemplos: 1 → 0,1; 14 → 1,4; 140 → 14,0; 145 → 14,5.

limitOdometerDigits já limita a 999.999 km, igual ao teto existente de savedTripActions.
Foi acrescentado teto de sete dígitos, inclusive para zeros à esquerda. O input tem
maxLength=8 para seis inteiros, vírgula e décimo. Caracteres não numéricos são
filtrados; entradas acima do limite mantêm o valor anterior. Não há dependências novas.

A navegação continua se ocultando durante entrada de texto, conforme o app,
mas focar um checkbox não a oculta.

## Arquivos

- src/modules/vehicle/VehicleModule.tsx
- src/modules/vehicle/TripsView.tsx
- src/modules/vehicle/TripDetailView.tsx
- src/modules/vehicle/TripFormView.tsx
- src/modules/vehicle/inputFormatters.ts
- src/styles/global.css
- src/modules/vehicle/inputFormatters.test.ts
- src/modules/vehicle/savedTripsViews.test.tsx
- src/modules/vehicle/vehicleViews.test.tsx
- tests/browser-trips-ux.cjs
- Este relatório.

## Verificação

- npm test: 258 testes passando em 23 arquivos; navegação acessível e seus três destinos, máscara,
  limite, backspace, volta opcional, payload numérico, total e custo indisponível.
- npm run build: passou; TypeScript, bundle de produção e service worker gerados.
- tests/browser-trips-ux.cjs: Chrome real sobre build de produção, com Auth/API
  controladas e IndexedDB real; nenhum dado sintético enviado ao backend pessoal.
- Larguras: 320, 360, 375, 390, 412 e 430px; lista, formulário, detalhe,
  ida/volta/total, nomes longos, distância máxima e calibração indisponível.
- Verificados overflow, nowrap, ellipsis real, touch targets, estado ativo,
  confirmação de exclusão e conteúdo acima da barra. Capturas inspecionadas.
- Evidências locais: .superpowers/trips-ux/result.json e PNGs no mesmo diretório.
- Revisão independente: sem achados acionáveis.

Cálculos, domínio, calibração, preço ANP, sincronização, IndexedDB, schema,
RLS e soft-delete permanecem com suas implementações existentes.
