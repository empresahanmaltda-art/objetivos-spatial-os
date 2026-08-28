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
- Salvamento automático no localStorage.
- Atualização entre abas do mesmo navegador.
- Backup e restauração em JSON.
- Layout responsivo com área segura para iPhone.
- PWA com cache offline.
- Permissão e exibição de lembretes locais enquanto o app está ativo, além de suporte de recebimento Web Push no service worker.

## Executar localmente

    python -m http.server 8080

Abra http://localhost:8080.

## Persistência

Todas as alterações são salvas automaticamente no navegador. O armazenamento local não atravessa aparelhos: sincronização automática entre celular e computador e notificações confiáveis com o app fechado requerem um backend autenticado que armazene os dados e envie Web Push. Nenhuma senha ou chave privada deve ser embutida no repositório público.
