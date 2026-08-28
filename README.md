# OBJETIVOS — Spatial OS

Aplicativo pessoal focado em duas coisas: tarefas e metas com prazo. Não há dados financeiros demonstrativos, Spotify, áreas paralelas ou dependências de build.

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
- Salvamento automático local imediato e sincronização autenticada com Supabase.
- Atualização em tempo real entre celular, computador e abas abertas.
- Backup e restauração em JSON.
- Layout responsivo com área segura para iPhone.
- PWA com cache offline.
- Lembretes locais e Web Push disparado pelo servidor mesmo com o PWA fechado.

## Executar localmente

    python -m http.server 8080

Abra http://localhost:8080.

## Sincronização e push

O frontend usa somente a URL e a chave publicável do Supabase em `cloud-config.js`. A segurança dos dados é garantida por autenticação e Row Level Security: cada conta lê e altera apenas o próprio estado. Chaves privadas, a chave administrativa, o segredo do cron e a chave VAPID privada ficam somente nos Secrets/Vault do Supabase.

O schema está em `supabase/migrations`, a função de notificações em `supabase/functions/push-due` e o agendamento em `supabase/setup-cron.example.sql`. Depois do deploy, abra Configurações no app, conecte o mesmo email em cada aparelho e ative os alertas separadamente em cada dispositivo.

No iPhone, notificações com o app fechado exigem instalar o site na Tela de Início e abrir essa versão instalada antes de ativar os alertas.
