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
- Currículos autenticados permanecem no estado privado de cada usuário e nunca são incluídos no repositório nem no pacote público do PWA.
- Visão de progresso por aula: conteúdo apenas visto não conta como dominado; a consolidação cresce com recuperação ativa espaçada.
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
