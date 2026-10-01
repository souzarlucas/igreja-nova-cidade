# Segurança

## Controles implementados

- Sessões opacas com validade de oito horas; somente o hash do identificador fica no banco. Cookie HttpOnly, SameSite=Strict e Secure quando servido por HTTPS.
- Senhas com salt individual e PBKDF2-SHA256, 600.000 iterações. No Worker, a derivação usa Web Crypto; localmente usa hashlib. Não reduza o custo de derivação para caber em uma cota de hospedagem.
- Contas criadas pelo administrador principal, sem registro público. Configuração inicial exige segredo privado e só cria a primeira conta uma vez.
- Autorizações verificadas no servidor. Tesouraria, Presbitério, Ministério e Membro não recebem acesso financeiro pela atribuição do perfil. A concessão é individual; Ministério/Membro ficam limitados ao vínculo próprio.
- Mudanças de perfil, de acesso, de senha e desativação revogam sessões. Administradores delegados não podem distribuir acessos. A conta principal não pode ser desativada ou rebaixada pela interface.
- Proteção de origem em operações POST e JSON obrigatório; validação dos campos no servidor, limite de 50 KB por solicitação, SQL parametrizado e restrição de tentativas de login.
- CSP, bloqueio de frames, nosniff, no-store, instruções de não indexação e HSTS sob HTTPS. Não indexação não substitui controle de acesso.
- Auditoria de operações; lançamentos financeiros e auditoria na mesma transação. Aprovação de pedidos e despesas vinculadas verificam os limites no próprio comando SQL.
- Valores de eventos retirados das respostas para usuários sem autorização financeira naquele ministério. A API anônima informa apenas se há configuração inicial pendente.

## Operação

Use HTTPS em produção e configure APP_ORIGIN com o endereço exato, sem barra final. Mantenha contas individuais e senhas únicas. Proteja a conta principal e a conta do provedor de nuvem; habilite MFA no provedor e no GitHub. O aplicativo ainda não possui MFA próprio.

O endereço poderá ser encontrado por terceiros, mesmo sem divulgação. Eles verão a entrada, mas não poderão consultar os dados sem conta autorizada. Código público não deve conter bancos, exportações, dados de membros, códigos de configuração ou chaves de acesso.

Faça backups privados do banco e teste restauração antes de depender do sistema. O banco pode conter dados pessoais e religiosos sensíveis. Limite sua coleta, evite inserir detalhes confidenciais em descrições de eventos visíveis aos membros e nunca coloque dumps no repositório público. Os eventos e o calendário são visíveis a todas as contas ativas.

As informações financeiras de um ministério ficam visíveis aos usuários desse ministério que o principal autorizar. O principal deve revisar o vínculo antes de conceder acesso. O Admin delegado tem acesso amplo, portanto atribua esse perfil apenas às pessoas que você escolher para essa responsabilidade.

As sessões expiram, mas uma tela já carregada pode continuar mostrando dados recebidos antes da revogação; a próxima consulta/operação será recusada. A interface consulta o servidor a cada cinco minutos e ao recuperar o foco para detectar revogações. Não há garantia de apagar dados previamente vistos, fotografados ou copiados por um usuário autorizado.

A auditoria é operacional, não um registro criptograficamente imutável. Administradores do banco/provedor podem modificá-la. Restrinja também o acesso ao provedor. Faça acompanhamento de cotas, erros e backups; serviços gratuitos não oferecem capacidade ilimitada.

## Relatar uma falha

Não publique senhas, dados de pessoas ou detalhes exploráveis em issues abertas. Use o canal privado do responsável pelo repositório ou o recurso privado de advisories do GitHub quando habilitado. Informe passos de reprodução usando dados fictícios.
