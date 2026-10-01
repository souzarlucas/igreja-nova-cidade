# Publicação restrita à igreja com plano gratuito

A configuração candidata usa Cloudflare Workers Python e D1 no plano **Free**, frontend com Static Assets e endereço gratuito `workers.dev`. Nenhum cadastro de membro é público. A página de entrada e os arquivos da interface poderão ser acessados pela internet; os dados da igreja exigem sessão e autorização verificada no servidor. Não divulgar o endereço não é o mecanismo de segurança.

## Estado de validação

O frontend compilou e os testes de integração passaram em SQLite local. Também foram verificados no simulador de Workers Python com D1: migrações, interface, configuração inicial, derivação de senha com Web Crypto, login, sessões, autorizações individuais, revogação, pedidos, reservas, transações e limites de despesas.

**A instância da igreja foi publicada na conta Cloudflare do responsável, com D1 e HTTPS.** O endereço e o código de configuração foram entregues privadamente. A API anônima, a recusa de gravações sem sessão, a proteção de origem e a recusa de código de configuração inválido foram verificadas no endereço remoto. A conta principal deve ser criada pelo responsável, com sua própria senha. Os fluxos autenticados foram testados localmente e no simulador de Workers/D1; a capacidade para uso simultâneo e a restauração de backups ainda devem ser validadas antes de operação plena. Nenhum plano pago foi ativado.

## Limites e custo

Referências oficiais verificadas em 30/09/2026:

- [Workers Free](https://developers.cloudflare.com/workers/platform/limits/): 100.000 solicitações por dia e limite de CPU de 10 ms por solicitação; memória de 128 MB. A contagem de tempo de CPU difere do tempo total esperando banco e operações externas.
- [D1 Free](https://developers.cloudflare.com/d1/platform/limits/): até 500 MB por banco, 5 GB de armazenamento total e recuperação Time Travel de 7 dias; consulte as cotas de leitura e gravação no painel e na [documentação de preços](https://developers.cloudflare.com/d1/platform/pricing/).
- O pacote Python gerado deve respeitar também o limite de tamanho de Worker do plano Free. Execute o dry-run e confira o tamanho comprimido antes de publicar.
- Se as cotas do plano Free forem excedidas, recursos poderão ficar indisponíveis até o próximo período. **Não ative o plano Paid nem cobrança automática** para resolver isso sem uma decisão do responsável.

51 a 200 contas podem ter uso leve ou intenso. O número de contas não equivale a usuários simultâneos e não garante que uma aplicação FastAPI com gráficos e banco caiba em 10 ms de CPU em todas as operações. A interface atualiza a sessão a cada cinco minutos e ao voltar ao foco para reduzir consultas. O desempenho no simulador não prova o desempenho em produção.

Preserve a segurança das senhas e as verificações de permissões caso seja necessário ajustar a arquitetura. Não reduza as 600.000 iterações de PBKDF2 para forçar o enquadramento na cota.

Google Drive/OneDrive podem servir futuramente para backups protegidos, mas não hospedam este backend. Google Cloud Run possui franquias gratuitas, porém requer conta de faturamento e pode gerar cobrança; por isso não é a opção padrão para a exigência de custo zero. Firebase Spark hospeda conteúdo estático e oferece serviços com cotas gratuitas, mas não executa este backend Python diretamente.

## Preparar

Instale Node.js 24 e uv, e execute no projeto:

```sh
npm ci
uv sync --locked
npm run build
uv run pywrangler deploy --config wrangler.toml --dry-run
```

O dry-run não publica. Python Workers usa pywrangler para instalar dependências compatíveis com WebAssembly. Os arquivos `uv.lock` e `pylock.toml` registram as dependências; não inclua ambientes virtuais ou `python_modules` no GitHub.

## Conectar sua conta e criar o banco

```sh
npx wrangler login
npx wrangler whoami
npx wrangler d1 create igreja-nova-cidade
```

O login é feito pelo responsável no navegador. Use uma conta no plano gratuito. Substitua o `database_id` de exemplo em `wrangler.toml` pelo ID retornado. O ID não é uma senha; o acesso depende das credenciais do provedor.

```sh
npx wrangler d1 migrations apply igreja-nova-cidade --remote --config wrangler.toml
```

As migrações são sequenciais. Não use um banco com dados antigos sem backup e verificação das migrações já aplicadas. Não envie o banco local de demonstração para produção.

## Segredo de configuração e origem

Gere um código longo e aleatório e mantenha-o privado. Configure usando a entrada interativa, sem colocá-lo no comando ou no repositório:

```sh
npx wrangler secret put SETUP_TOKEN --config wrangler.toml
```

Configure o endereço exato HTTPS da implantação em `APP_ORIGIN`, sem barra final, também por entrada interativa:

```sh
npx wrangler secret put APP_ORIGIN --config wrangler.toml
```

O endereço segue o padrão `https://igreja-nova-cidade.<seu-subdominio>.workers.dev`. Obtenha o subdomínio real no painel da conta. Se ainda não houver origem configurada, a API compara a origem da solicitação com a própria URL; fixe APP_ORIGIN antes de colocar em operação.

```sh
uv run pywrangler deploy --config wrangler.toml
```

## Criar a conta principal e verificar

Abra o endereço real retornado pelo deploy. Informe o código de configuração e crie sua própria senha para a primeira conta. Depois de criar e confirmar o acesso, remova o segredo que não é mais necessário:

```sh
npx wrangler secret delete SETUP_TOKEN --config wrangler.toml
```

Verifique com contas fictícias: acesso anônimo sem dados, financeiro bloqueado para Tesouraria/Presbitério, liberação individual, isolamento de dois ministérios, revogação e logout, lançamento detalhado, aprovação e despesas vinculadas. Confira erros, CPU e cotas no painel. Somente a conta principal gerencia autorizações; não conceda Admin como atalho para acesso financeiro.

A primeira versão não inclui integrações Microsoft/Google ou envio de e-mail. Contas e senhas iniciais são criadas pelo administrador principal e transmitidas por um canal privado fora deste sistema.

## Backup e restauração

O provedor já controla o acesso ao D1; não torne o banco público. Exporte para um local privado:

```sh
npx wrangler d1 export igreja-nova-cidade --remote --output=backup-privado.sql --config wrangler.toml
```

Mova o arquivo para armazenamento protegido fora do repositório. Backups podem conter nomes, dados religiosos, registros financeiros e hashes de senha. Use criptografia antes de enviar para Drive/OneDrive e teste a restauração em banco separado. A retenção curta do Time Travel não substitui um backup independente. Não sincronize o SQLite local aberto com um cliente de Drive/OneDrive.

## Desenvolvimento com D1 local

```sh
npx wrangler d1 migrations apply igreja-nova-cidade --local --config wrangler.toml --persist-to .wrangler/python-dev
uv run pywrangler dev --config wrangler.toml --persist-to .wrangler/python-dev --port 8788
```

Use dados fictícios nesse ambiente. Ele é separado do SQLite da prévia local e do banco remoto.
