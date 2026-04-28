# Nana's Point

Nana's Point e um app web mobile-first para controle pessoal de ponto, pausas e banco de horas. O MVP foi pensado para uso rapido no iPhone, com visual leve inspirado em Material Design, cores laranja e verde, Supabase para autenticacao/dados e Framer Motion para microinteracoes.

## Stack

- Next.js App Router
- React + TypeScript
- Material UI
- Framer Motion
- Supabase Auth + Postgres
- Vitest + Testing Library

## Funcionalidades do MVP

- Login e cadastro com e-mail/senha via Supabase Auth quando as variaveis estiverem configuradas.
- Login obrigatorio com Supabase; sem variaveis de ambiente o app bloqueia entrada.
- Tela "Hoje" com status do dia, horas trabalhadas, pausas e banco de horas.
- Registro de ponto com selecao de horario e observacao opcional.
- Registro de pausas por categoria: almoco, medico, doenca, viagem, pessoal e outro.
- Calendario mensal com marcadores visuais de status.
- Banco de horas com creditos, debitos e saldo acumulado.
- Historico mensal com dias registrados.
- Bottom navigation otimizada para celular.
- Animacoes de entrada, transicao de telas, botoes e feedbacks com Framer Motion.

## Arquitetura

O codigo separa dominio, dados e interface:

- `src/domain/time`: regras puras de calculo de jornada, pausas, resumo semanal e banco de horas.
- `src/features/time-tracking`: estado do MVP, telas e componentes do produto.
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
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Sem essas variaveis, o app nao permite entrada porque o MVP usa apenas dados reais do Supabase.

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

Tambem sera necessario manter o provedor de e-mail habilitado no painel do Supabase Auth.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Regras de negocio

- Meta semanal padrao: 30 horas.
- Horas acima da meta semanal geram credito no banco de horas.
- Horas abaixo da meta semanal geram debito.
- Horas trabalhadas no dia consideram chegada, saida, almoco e pausas descontaveis.
- Pausas medicas e de doenca podem ser registradas como contexto sem desconto automatico.

## Status

Este MVP entrega a base visual, dominio testado, migrations Supabase e fluxos principais navegaveis. Proximas evolucoes naturais:

- Persistir todos os registros criados pela UI diretamente no Supabase.
- Editar registros antigos.
- Notificacoes de lembrete.
- Feriados e jornadas configuraveis.
- Relatorios/exportacao mensal.
