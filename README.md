# Nova Cidade — Gestão da Igreja

Sistema open source para a Igreja de Cristo em Nova Cidade. Licença MIT; não exige pagamento de licença. Hospedagem e serviços de terceiros têm seus próprios limites e custos.

## Funcionalidades

- Cadastro de ministérios, informações, responsáveis e membros.
- Eventos com descrição, objetivo, equipe, início, horário opcional, término, local, valor previsto e status.
- Calendário geral: concluído verde; programado azul; em andamento amarelo; atrasado vermelho. Atraso é calculado quando a data final (ou inicial quando não há término) passou sem conclusão.
- Orçamentos anuais e mensais por ministério, área associada ao orçamento, despesas por área e evento, saldos e gasto mensal.
- Dashboard com indicadores, status e consumo financeiro. Filtros por responsável, status, mês, ano e ministério.
- Login por e-mail e senha; usuários cadastrados pelo administrador; desativação e redefinição de senha.
- Prazo mensal configurável pelo Admin, calculado no fuso America/Manaus.
- Registro de operações administrativas e financeiras.

## Perfis

| Perfil | Permissões |
| --- | --- |
| Admin | Cadastros, atividades, finanças, usuários e configurações |
| Ministério | Calendário geral; cadastro/edição de atividades do próprio ministério até o prazo; consulta financeira e membros do próprio ministério |
| Tesouraria | Consulta geral e lançamentos de orçamento e despesas |
| Presbitério / Admin | Gestão completa, com as mesmas permissões do Admin |

O calendário geral mostra nome, datas, descrição e responsáveis dos eventos. Valores previstos de outros ministérios são removidos da resposta do servidor para o perfil Ministério. Mantenha informações pessoais fora da descrição pública interna de eventos.

## Cálculos financeiros

Valores monetários são armazenados em centavos. O valor previsto do evento não debita o saldo: somente uma despesa realizada debita. O orçamento anual e os limites mensais são registros separados; não são somados entre si. A visão mensal compara despesas com orçamento daquele mês e a anual compara com o orçamento anual. Saldo = orçamento − despesas; percentual = despesas / orçamento × 100. Sem orçamento cadastrado, o indicador mostra 0% e informa a ausência de limite. Saldo negativo indica excesso de gasto, não bloqueia o lançamento.

Uma área é associada ao orçamento de cada ministério/período; a tabela e a seção de gastos por área permitem acompanhar essa divisão. Há um orçamento por ministério/período, editável. Revisões substituem o valor vigente e são registradas na auditoria.

## Executar localmente

Requer Node.js 22.13+ e npm. A aplicação usa React/Vinext com runtime Cloudflare Workers e banco SQLite D1. Não suporta GitHub Pages, que não executa o servidor de autenticação.

```sh
npm ci
npm run db:generate
```

Crie `.dev.vars` a partir de `.dev.vars.example`, com um SETUP_TOKEN longo e aleatório. A aplicação nunca tem senha padrão. Para testar com banco local:

```sh
npm run build
npx wrangler d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file drizzle/0000_pretty_luke_cage.sql
npx wrangler d1 execute DB --local --persist-to .wrangler/state --config dist/server/wrangler.json --file drizzle/0001_ambiguous_korvac.sql
npm start
```

Abra a URL indicada e crie o primeiro administrador com o código SETUP_TOKEN. Após a primeira conta, novas configurações iniciais são bloqueadas. Admin cria os demais usuários em Configurações. Senhas têm mínimo de 12 caracteres; sessões duram 8 horas. Remova o segredo de configuração após concluir o primeiro acesso.

## Hospedagem

O checkout contém `.openai/hosting.json` para publicação via Sites (D1 `DB`). A demonstração publicada começa privada para o proprietário; esse controle externo é separado dos perfis da igreja. Para disponibilizar o sistema aos membros sem depender desse acesso externo, configure a audiência/hospedagem apropriada antes de convidar usuários. Em Cloudflare independente, configure D1 `DB`, as migrações e SETUP_TOKEN como segredo de runtime. O código é portátil para esse runtime; os serviços não fazem parte da licença MIT.

## Segurança e operação

Consulte [SECURITY.md](SECURITY.md). O sistema contém controles de segurança, mas não tem garantia de imunidade a invasões nem substitui auditoria independente. Banco de dados, backups, credenciais, arquivos `.dev.vars`, `.env*` e dados reais nunca devem ir ao GitHub. Antes de usar com dados reais, habilite backups no provedor e teste restauração; revise acessos; mantenha dependências atualizadas. Use HTTPS. Senhas esquecidas são redefinidas pelo Admin, sem e-mail automático.

## Verificação

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/security.test.ts
npm run build
```

Preserve os avisos de licença das dependências e arquivos do starter; a licença MIT cobre o código original deste projeto.
