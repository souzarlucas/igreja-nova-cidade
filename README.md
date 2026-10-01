# Igreja de Cristo em Nova Cidade

Sistema de gestão de ministérios, membros, eventos e recursos da igreja. Código aberto sob licença MIT, com interface em português e backend Python com FastAPI. A licença permite uso gratuito, modificação e publicação do código. Dados reais, bancos, senhas e segredos permanecem privados.

## Funcionalidades

- Cadastro de ministérios e membros, atividades com datas, horários opcionais, objetivos, equipes e responsáveis.
- Calendário geral: concluído verde, programado azul, em andamento amarelo, atrasado vermelho; filtros por responsável, status, mês, ano e ministério.
- Entradas e saídas, resultado do período e saldo acumulado. Despesas com justificativa e itens separados por categoria.
- Orçamentos anuais e mensais por ministério e área. Gráficos automáticos, consumo, saldo e sinais de concentração de gastos.
- Pedidos de recursos com justificativa, objetivo e itens obrigatórios. Aprovação ou rejeição registrada com responsável e motivo. O autor não decide o próprio pedido.
- A aprovação reserva orçamento e não lança uma despesa automaticamente. Despesas vinculadas não podem exceder o total aprovado. As verificações e os registros de auditoria usam transações no banco.
- Quando existem limites mensal e anual para a mesma área, a aprovação respeita ambos. Na ausência de limite mensal, usa o anual. Orçamento não equivale ao dinheiro em caixa.
- Login por e-mail e senha, contas criadas pelo administrador principal, bloqueio de contas, redefinição de senha e revogação imediata das sessões ao mudar permissões.

## Autorizações

| Perfil | Acesso |
| --- | --- |
| Administrador principal | Gestão completa; único que cria contas, atribui perfis e concede/revoga acesso financeiro |
| Admin escolhido pelo principal | Gestão operacional completa; não administra autorizações de pessoas |
| Tesouraria | Sem financeiro até liberação individual; depois pode consultar a igreja, registrar entradas, saídas, orçamentos e decidir pedidos |
| Presbitério | Sem financeiro até liberação individual; depois consulta o financeiro da igreja e decide pedidos, sem editar movimentações |
| Ministério | Atividades próprias até o prazo configurado; financeiro bloqueado inicialmente; quando autorizado, consulta e lança entradas e despesas detalhadas apenas no seu ministério e solicita recursos até o prazo |
| Membro | Calendário e atividades; financeiro bloqueado inicialmente; quando autorizado, consulta apenas seu ministério |

Ser administrador é uma autorização ampla concedida exclusivamente pela conta principal. Somente essa conta pode promover alguém a Admin. A autorização financeira é verificada no servidor em cada consulta e operação, além de controlar a interface. Revogar acesso encerra as sessões existentes.

## Executar localmente

Requisitos: Node.js 24, Python 3.13 ou posterior e [uv](https://docs.astral.sh/uv/).

```sh
npm ci
uv sync --locked
cp .dev.vars.example .dev.vars
```

Edite `.dev.vars` e configure um `SETUP_TOKEN` longo, aleatório e privado. Uma opção para gerar o valor é `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Não envie esse arquivo ao GitHub.

```sh
npm run build
npm start
```

Abra http://127.0.0.1:8787. Na primeira abertura, informe o código de configuração, seu nome, e-mail e uma senha de pelo menos 12 caracteres para criar a conta principal. Não existe senha padrão nem cadastro público. O banco local é `.local/church.sqlite`, criado e migrado automaticamente. Este comando escuta apenas no próprio computador; para acesso remoto use a implantação HTTPS descrita em [DEPLOYMENT.md](DEPLOYMENT.md).

Para desenvolver a interface, execute `npm run dev` em outro terminal. Não habilite acesso de produção pelo servidor de desenvolvimento.

```sh
uv run python -m pytest tests -q
npm run build
```

Os testes usam bancos temporários e dados fictícios. Verificam isolamento entre ministérios, bloqueios por perfil e por pessoa, revogação de sessões, proteção de origem, aprovação e reserva de orçamento, limites de despesas e prazo de lançamento.

## Hospedagem e armazenamento

Há configuração para Cloudflare Workers Python + D1, com frontend React/Vite e endereço gratuito `workers.dev`. A operação no plano gratuito depende das cotas e do desempenho real; a quantidade de contas, sozinha, não garante capacidade. Consulte [DEPLOYMENT.md](DEPLOYMENT.md) para os limites, comandos e validações necessárias antes de inserir dados reais.

Não foram ativados serviços pagos, integrações Microsoft/Google ou domínio pago. Google Drive e OneDrive não são bancos transacionais ou hospedagem deste backend. Podem receber cópias de backup protegidas em uma integração futura; não sincronize o banco SQLite aberto diretamente nesses serviços.

## Estrutura

- `backend/`: FastAPI, validação, sessões, políticas de autorização e adaptadores SQLite/D1.
- `app/page.tsx`, `components/finance.tsx`: aplicação React.
- `drizzle/*.sql`: migrações SQL sequenciais, utilizadas pelo SQLite local e pelo D1. São a fonte do esquema; não exigem Drizzle em execução.
- `tests/test_api.py`: testes de integração das políticas e fluxos financeiros.
- `wrangler.toml`, `pyproject.toml`, `uv.lock`, `pylock.toml`: configuração e dependências da implantação Python.

Leia [SECURITY.md](SECURITY.md) para operação, backups e comunicação privada de vulnerabilidades. O sistema inclui controles de segurança, mas não promete invulnerabilidade.
