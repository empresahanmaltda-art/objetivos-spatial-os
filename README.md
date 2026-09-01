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
- Cinco formas de recuperação: reconhecimento, produção escrita, lacuna, ditado e shadowing.
- Estado de memória por cartão com dificuldade, estabilidade, recuperabilidade e retenção-alvo de 90%.
- Proteção contra acúmulo: no máximo 20% da sessão vem do backlog atrasado.
- Comparação Unicode tolerante a pequenos erros e à diferença entre `е` e `ё`.
- Voz russa nativa do aparelho e explicações de gramática, estrutura, pronúncia e associação mental.
- Importação preservada de texto e PDF; materiais privados ficam isolados por usuário.
- Geração por IA autenticada no servidor com Responses API e Structured Outputs estrito.

## Executar localmente

    python -m http.server 8080

Abra http://localhost:8080.

## Sincronização e push

O frontend usa somente a URL e a chave publicável do Supabase em `cloud-config.js`. A segurança dos dados é garantida por autenticação e Row Level Security: cada conta lê e altera apenas o próprio estado. Chaves privadas, a chave administrativa, o segredo do cron e a chave VAPID privada ficam somente nos Secrets/Vault do Supabase.

O schema está em `supabase/migrations`, a função de notificações em `supabase/functions/push-due` e o agendamento em `supabase/setup-cron.example.sql`. Depois do deploy, abra Configurações no app, use “Continuar com Google” em cada aparelho e ative os alertas separadamente em cada dispositivo.

No iPhone, notificações com o app fechado exigem instalar o site na Tela de Início e abrir essa versão instalada antes de ativar os alertas.

## Fluency inteligente

O motor local está em `fluency-engine.js` e continua funcionando offline. O enriquecimento de materiais fica em `supabase/functions/fluency-generate`: a chave da OpenAI nunca entra no PWA. A função autentica o usuário, baixa somente arquivos do caminho privado dele, trata o conteúdo como dado não confiável e devolve até 30 cartões em JSON estrito.

Para ativar o pipeline em um projeto Supabase já vinculado:

    supabase db push
    supabase secrets set OPENAI_API_KEY=... OPENAI_FLUENCY_MODEL=gpt-5.6-terra
    supabase functions deploy fluency-generate

O bucket `fluency-materials` é privado e criado pela migration `202609010001_fluency_materials.sql`. Se a IA estiver temporariamente indisponível, o texto original e as linhas ainda não resolvidas permanecem no estado sincronizado; o material pode ser processado depois sem perda.
