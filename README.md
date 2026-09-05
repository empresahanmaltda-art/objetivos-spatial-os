# OBJETIVOS — Spatial OS

Aplicativo pessoal de execução diária: tarefas, projetos, metas com prazo e aquisição adaptativa de idiomas. Não há dados financeiros demonstrativos, Spotify ou dependências de build no frontend.

## Recursos

- Agenda compacta com navegação por dia.
- Visão dos próximos 14 dias.
- Virada automática para o dia atual à meia-noite e ao reabrir o app.
- Recorrências diárias, semanais, mensais, anuais e personalizadas, pela data programada ou pela conclusão.
- Rotina Operação Moscou carregada como 26 recorrências editáveis.
- Tarefas concluídas saem da lista principal; a próxima ocorrência reaparece na data correta.
- Datas e recorrências em linguagem natural pelo assistente.
- Swipe nos dias e tarefas, transições Spatial e feedback tátil quando suportado.
- Temas Spatial, quente, frio e sexy, com seletor manual de cor e intensidade.
- Metas com alvo, realizado, unidade e prazo.
- Valores realizados começam em zero; alvos e prazos pessoais são preservados.
- Assistente local para criar, concluir e reagendar tarefas, além de criar, atualizar e zerar metas.
- Salvamento automático local imediato e sincronização autenticada com Google via Supabase.
- Atualização em tempo real entre celular, computador e abas abertas.
- Backup e restauração em JSON.
- Layout responsivo com área segura para iPhone.
- PWA com cache offline.
- Lembretes locais e Web Push disparado pelo servidor mesmo com o PWA fechado.
- Aba Fluency com perfil CEFR por habilidade, fila adaptativa e histórico de sessões.
- O pacote atual não contém o currículo particular. Os materiais são carregados do estado autenticado, protegido por RLS.
- Progresso por aula é uma estimativa de memória dos cartões, não certificação de domínio ou de fluência.
- A aula mais recente é sempre a aula atual: ocupa de 50% a 60% do aquecimento enquanto ainda está fraca, sem abandonar a revisão acumulativa das anteriores.
- Terça e quinta têm um único aquecimento pré-aula; depois de concluído, o painel volta ao treino normal do dia.
- Cinco formas de recuperação: reconhecimento, produção escrita, lacuna, ditado e shadowing.
- Estado de memória por cartão com dificuldade, estabilidade, recuperabilidade e retenção-alvo de 90%.
- Autoavaliação em três escolhas claras: Difícil (repete e volta logo), Bom (intervalo cresce) e Fácil (manutenção).
- Proteção contra acúmulo: no máximo 20% da sessão vem do backlog atrasado.
- Comparação Unicode tolerante a pequenos erros e à diferença entre `е` e `ё`.
- Voz russa nativa do aparelho e explicações de gramática, estrutura, pronúncia e associação mental.
- Importação local de pares russo–português já revisados, sem transmissão para serviços externos.
- Aulas novas, Canvas e PDFs são analisados nesta conversa e gravados diretamente no currículo privado do usuário.

## Executar localmente

    python -m http.server 8080

Abra http://localhost:8080.

## Sincronização e push

O frontend usa somente a URL e a chave publicável do Supabase em `cloud-config.js`. A segurança dos dados é garantida por autenticação e Row Level Security: cada conta lê e altera apenas o próprio estado. Chaves privadas, a chave administrativa, o segredo do cron e a chave VAPID privada ficam somente nos Secrets/Vault do Supabase.

O schema está em `supabase/migrations`, a função de notificações em `supabase/functions/push-due` e o agendamento em `supabase/setup-cron.example.sql`. Depois do deploy, abra Configurações no app, use “Continuar com Google” em cada aparelho e ative os alertas separadamente em cada dispositivo.

No iPhone, notificações com o app fechado exigem instalar o site na Tela de Início e abrir essa versão instalada antes de ativar os alertas.

## Fluency inteligente

O motor local fica em `fluency-engine.js` e continua funcionando offline depois que o usuário autenticado sincroniza seu estado. Currículos e links particulares vivem apenas no registro protegido por RLS no Supabase. O PWA não envia PDFs nem textos de aula para uma API de IA: aulas novas são entregues e analisadas nesta conversa, depois inseridas diretamente no estado privado sem entrar no repositório público.

## Verificação de aprendizado (build 35)

- Desafio de uso próprio com frases novas, produção oral sem leitura e pergunta/resposta. A tentativa e o rascunho são privados; as notas são identificadas como autoavaliação, sem inflar a memória dos cartões.
- Evidência de recuperação escrita: acertos sem ajuda, em pelo menos dois dias separados por sete dias, com um acerto nos últimos 30 dias. Esses limiares são critérios operacionais do app, não uma escala de proficiência validada.
- Níveis CEFR são informados no perfil. Lacunas não contam como interação oral; shadowing não é avaliação automática de pronúncia.
- Cobertura do material exige `sourcePages` por cartão, `pageCount` por aula e uma auditoria registrada em `coverageReviewedAt`. Capas/páginas sem conteúdo podem constar de `excludedPages` com justificativa. Sem esse mapeamento o app informa que a cobertura integral não está comprovada.
- Aumentar a proficiência exige também uso real e feedback. Não há garantia de fluência por prazo, número de cartões ou nota.

Fundamentação: [recuperação ativa e retenção](https://doi.org/10.1111/j.1467-9280.2006.01693.x) e [habilidades descritas pelo CEFR](https://www.coe.int/en/web/common-european-framework-reference-languages/table-2-cefr-3.3-common-reference-levels-self-assessment-grid). O agendador é uma heurística própria; não é uma implementação validada de FSRS.

## Confiabilidade e testes

`npm ci --ignore-scripts` e `npm test` executam testes de currículo, migração, UI, sincronização e DOM. JSDOM é dependência apenas de desenvolvimento; não entra no frontend. A publicação é precedida pelos testes no GitHub Actions.

O salvamento conserva o snapshot mais recente enquanto um upload está em andamento, mantém pendências após falhas e ignora ecos próprios sem depender da ordem de campos JSONB. Atualizações discretas preservam os nós DOM dos cartões e o campo em edição. Dados locais de uma conta não são enviados automaticamente para outra.

A sincronização ainda usa snapshots do estado inteiro: edição simultânea em aparelhos diferentes não tem mesclagem campo a campo. Os testes de DOM não substituem validação visual e de gestos no Safari/iPhone. O cache contém somente os recursos públicos; a remoção de qualquer material que tenha existido em histórico remoto exige o procedimento do provedor.
