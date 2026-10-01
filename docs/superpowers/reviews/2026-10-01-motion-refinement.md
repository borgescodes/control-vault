# Acabamento de movimento

Brief aprovado: intensidade marcante e contida. Escopo exclusivamente visual,
sem dependências novas ou mudanças de domínio, persistência e sincronização.
Rota recomendada: Sol / Medium; a sessão não troca modelo/esforço.

## Direção

- Momento principal: preenchimento inicial da barra em 880ms e faixa de luz
  contínua dentro do combustível conhecido, sem modificar o nível.
- Continuidade: métricas interpolam da leitura atual para o novo valor,
  inclusive quando uma atualização interrompe a anterior.
- Feedback: entrada curta do ícone ativo, resposta ao toque, marca do checkbox
  e revelação de erro/confirmação. Navegação entre telas mantém os 210ms existentes.
- Orçamento: só a faixa da barra possui um novo loop. Não há stagger de
  conteúdo, movimento de fundo ou animação ornamental em cada bloco.

## Implementação

FuelProgress mantém os atributos acessíveis e a largura real do preenchimento.
IntersectionObserver pausa a faixa fora da tela; visibilitychange a pausa com
documento oculto. matchMedia acompanha mudanças de preferência em tempo real.
Uma barra vazia permanece sem movimento contínuo.

O sweep deriva de src/panel.css do lovable-credit-monitor: ciclo de 3,6s,
cubic-bezier(.4,0,.2,1), inclinação de -18 graus e envelope de opacidade
0 / .5 / .46 / 0. A posição usa transform em vez de left para evitar layout
contínuo. A geometria reta, cores e tipografia do Control Vault permanecem.

AnimatedMetric conserva os 880ms e ease-out cúbico existentes, cancela frames
interrompidos e finaliza imediatamente ao ocultar o documento ou ativar
movimento reduzido. No modo reduzido, CSS remove sweep, preenchimento animado,
entrada dos ícones e movimento das mensagens, mantendo os estados finais.

## Verificação

- npm test: 260 testes passaram em 24 arquivos.
- npm run build: passou e gerou o service worker. Vite emitiu aviso de chunk
  acima de 500kB (500,27kB; 141,50kB gzip); não foi feita refatoração de bundle.
- tests/browser-motion.cjs: confirmou transformação contínua, percentual e
  largura estáveis, pausa fora da tela, evento controlado de visibilidade,
  mudança real de prefers-reduced-motion e feedback dos controles.
- Viewports: 320, 360, 375, 390, 412, 430 e 1440px, sem overflow ou erros de página.
- tests/browser-trips-ux.cjs: regressão passou nas seis larguras mobile.
- Capturas da Home e de diferentes instantes do sweep inspecionadas em
  .superpowers/motion; resultado em .superpowers/motion/result.json.
- Revisão independente: nenhum achado acionável.
- Impeccable detector: um aviso na transição de width de 880ms, já existente
  e mantida conforme a referência aprovada. Ela ocorre em mudanças do nível;
  o novo loop utiliza transform/opacity e não anima layout.

## Arquivos

- src/modules/vehicle/HomeView.tsx
- src/modules/vehicle/FuelProgress.tsx
- src/modules/vehicle/FuelProgress.test.tsx
- src/shared/ui/AnimatedMetric.tsx
- src/shared/ui/AnimatedMetric.test.tsx
- src/styles/global.css
- tests/browser-motion.cjs
- Este relatório.
