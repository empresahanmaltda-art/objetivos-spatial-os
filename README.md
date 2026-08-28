# OBJETIVOS — Spatial OS

Aplicativo pessoal focado em duas coisas: tarefas e metas com prazo. Não há dados financeiros demonstrativos, Spotify, áreas paralelas ou dependências de build.

## Recursos

- Agenda compacta com navegação por dia.
- Visão dos próximos 14 dias.
- Tarefas únicas ou recorrentes.
- Tarefas concluídas saem da lista principal e permanecem em um histórico recolhido.
- Metas com alvo, realizado, unidade e prazo.
- Valores realizados começam em zero; alvos e prazos pessoais são preservados.
- Assistente local para criar, concluir e reagendar tarefas, além de criar, atualizar e zerar metas.
- Salvamento automático no localStorage.
- Atualização entre abas do mesmo navegador.
- Backup e restauração em JSON.
- Layout responsivo com área segura para iPhone.
- PWA com cache offline.

## Executar localmente

    python -m http.server 8080

Abra http://localhost:8080.

## Persistência

Todas as alterações são salvas automaticamente no navegador. O armazenamento local não atravessa aparelhos: sincronização automática entre celular e computador requer um banco online com autenticação. Nenhuma senha ou chave privada deve ser embutida no repositório público.
