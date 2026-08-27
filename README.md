# OBJETIVOS — Spatial OS

Aplicativo web local, sem build e sem dependências externas obrigatórias. O estado é persistido no `localStorage` do navegador e pode ser exportado/importado em JSON.

## Abrir

### Mais simples
Abra `index.html` no navegador.

### Como PWA / com cache offline
Execute um servidor local nesta pasta:

```bash
python -m http.server 8080
```

Depois abra `http://localhost:8080`.

No Windows, também é possível usar `start.bat` se Python/py estiver instalado.

## O que está funcional

- Hoje: timeline unificada de tarefas, rotinas, reuniões e compromissos.
- Tarefas fixas e flexíveis.
- Reorganização automática de tarefas flexíveis quando o calendário muda.
- Detecção de conflito entre compromissos fixos.
- Recorrências com conclusão independente por ocorrência.
- Histórico de conclusões persistente.
- XP e nível.
- Streak/consistência visual.
- Semana com visão de carga e eventos.
- Metas conectadas a tarefas, finanças e peso.
- Ciclo de 12 semanas.
- Financeiro com receitas, despesas, lucro, meta e histórico.
- TikTok, Russo, Dieta, Academia e Marketing.
- Controle executivo.
- Conquistas.
- Registro de peso.
- Comandos naturais locais para criar reunião/tarefa, otimizar agenda e consultar meta financeira.
- Spotify por URL de embed configurável.
- Backup e restauração dos dados em JSON.
- Layout responsivo desktop/mobile.
- PWA básica e cache offline quando servido por HTTP/HTTPS.

## Observação sobre IA

O planejamento automático incluído funciona localmente com um motor determinístico de agenda: ele respeita compromissos fixos, prioridade, duração, prazos e janelas livres. O campo “Comando IA” possui interpretação local dos comandos principais. Uma IA generativa em nuvem (OpenAI/Gemini/etc.) exigiria credenciais/API e um backend próprio; nenhuma chave é embutida no pacote.

## Dados

O app inicia com dados demonstrativos para deixar os dashboards preenchidos. Use Configurações → Restaurar demo para voltar ao estado inicial ou Backup → Exportar antes de fazer mudanças importantes.
