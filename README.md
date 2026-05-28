# Nana's Point

Nana's Point e um app web mobile-first para controle pessoal de ponto, pausas e banco de horas. O produto foi pensado para uso rapido no iPhone, com visual leve inspirado em Material Design, cores laranja e verde, Supabase para autenticacao/dados e Framer Motion para microinteracoes.

## Stack

- Next.js App Router
- React + TypeScript
- Material UI
- Framer Motion
- Supabase Auth + Postgres
- Vitest + Testing Library

## Funcionalidades

- Login e cadastro com e-mail/senha via Supabase Auth.
- Login obrigatorio com Supabase; sem variaveis de ambiente o app bloqueia entrada.
- Tela "Hoje" com status do dia, horas trabalhadas, pausas e banco de horas.
- Registro de ponto com selecao de horario e observacao opcional.
- Registro de pausas por categoria: almoco, medico, doenca, viagem, pessoal e outro.
- Calendario mensal com marcadores visuais de status.
- Banco de horas baseado apenas em movimentos salvos no Supabase.
- Historico mensal com dias registrados.
- Bottom navigation otimizada para celular.
- Animacoes de entrada, transicao de telas, botoes e feedbacks com Framer Motion.

## Garantia de dados

A interface nao usa dados demonstrativos, informacoes ficticias, atalhos locais ou registros mockados. Quando ainda nao existem registros no Supabase, a tela exibe estados vazios como "Sem registros", "Sem saldo" ou "Nenhum movimento lançado ainda".

O banco de horas exibido ao usuario e calculado somente a partir da tabela `hour_bank_movements`. A semana atual pode mostrar horas registradas, mas nao cria debito automatico quando nao ha fechamento salvo.

## Arquitetura

O codigo separa dominio, dados e interface:

- `src/domain/time`: regras puras de calculo de jornada, pausas, resumo semanal e banco de horas.
- `src/features/time-tracking`: estado das telas, fluxo de ponto e componentes do produto.
- `src/lib/supabase`: cliente Supabase lazy e contratos de banco.
- `src/shared`: tema Material UI e presets de motion.
- `supabase/migrations`: schema inicial e politicas RLS.

As regras de negocio ficam fora dos componentes para facilitar testes, evolucao e manutencao.

## Configuracao

Instale dependencias:

```bash
npm install
```

Crie um arquivo `.env.local` baseado em `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Use preferencialmente `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave `sb_publishable_...`).
Se quiser, pode manter tambem a chave legada `NEXT_PUBLIC_SUPABASE_ANON_KEY` como fallback.

Sem URL + chave publica, o app nao permite entrada porque o produto usa apenas dados reais do Supabase.

## Supabase

A migration inicial cria as tabelas:

- `profiles`
- `time_entries`
- `break_entries`
- `hour_bank_movements`

Todas as tabelas possuem RLS para garantir que cada usuario acesse apenas seus proprios dados.

Para aplicar a migration em um projeto Supabase:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Tambem sera necessario manter o provedor de e-mail habilitado no painel do Supabase Auth. Se quiser cadastro sem confirmacao por e-mail, desative a confirmacao em Authentication > Providers > Email no painel do Supabase.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Teste local rapido

1. Instale dependencias:

```bash
npm install
```

2. Configure `.env.local` com URL e chave publica do Supabase.

3. Rode o app local:

```bash
npm run dev
```

4. Abra no navegador:

```text
http://localhost:3000
```

5. Validacoes antes de subir alteracoes:

```bash
npm run lint
npm run test
npm run build
```

## Regras de negocio

- Jornada semanal de referencia: 30 horas.
- Horas acima da referencia semanal podem gerar credito quando houver movimento salvo.
- Horas abaixo da referencia semanal podem gerar debito quando houver movimento salvo.
- Horas trabalhadas no dia consideram chegada, saida, almoco e pausas descontaveis.
- Pausas medicas e de doenca podem ser registradas como contexto sem desconto automatico.

## Status

O produto possui base visual, dominio testado, migrations Supabase e fluxos principais conectados ao Supabase. Proximas evolucoes naturais:

- Editar registros antigos.
- Criar fechamento semanal para lançar credito/debito no banco de horas.
- Notificacoes de lembrete.
- Feriados e jornadas configuraveis.
- Relatorios/exportacao mensal.
