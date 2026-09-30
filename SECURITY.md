# Segurança

## Controles implementados

- Autorização no servidor em cada escrita, com isolamento financeiro por ministério.
- Prazo de lançamento validado no servidor no fuso America/Manaus.
- Senhas derivadas com PBKDF2 SHA-256, salt aleatório individual e 100.000 iterações (limite do WebCrypto do Cloudflare Workers); comparação sem saída antecipada. Considere Argon2id num runtime que o suporte para maior resistência a ataques offline.
- Sessões opacas aleatórias: banco armazena apenas hash SHA-256, expiração de 8 horas; cookies HttpOnly, SameSite=Strict e Secure em HTTPS. Logout e redefinição de senha revogam sessões.
- Cinco erros de login por par e-mail/IP bloqueiam novas tentativas por 15 minutos; não é proteção global contra botnets. Recomenda-se complementar com limitação de tráfego e WAF do provedor para uso real.
- Proteção contra CSRF por verificação de origem, JSON obrigatório e SameSite. Nenhuma alteração via GET.
- Validação de tamanho e formato, valores em centavos, SQL preparado; textos renderizados com escape pelo React.
- CSP, prevenção de enquadramento, MIME sniffing e política de referenciador. CSP ainda permite inline scripts devido ao framework; não usa eval em produção.
- Respostas de dados com Cache-Control no-store; nenhuma senha/hash retornada ao navegador.
- Primeiro Admin exige segredo SETUP_TOKEN do runtime; criação atômica somente enquanto não há usuários.
- Logs de operações armazenam usuário, ação, alvo e momento, sem senha ou conteúdo completo de dados pessoais.

## Limites e obrigações de operação

Não há promessa de sistema invulnerável. Não foi realizado pentest independente. A proteção depende de HTTPS, configuração do provedor, atualização de dependências, força das senhas, controle das contas administradoras e backup/restauração. Dados em SQLite são protegidos por controles do serviço; não há criptografia de campos pela aplicação. MFA, recuperação automática por e-mail e alerta de intrusão não estão implementados. A auditabilidade registra operações, não versões completas de registros. Não insira dados pessoais desnecessários; restrinja contas e mantenha política de retenção e exclusão apropriada.

O Site inicialmente privado possui um controle externo de acesso ao proprietário. É necessário ajustar a hospedagem/audiência antes de permitir acesso aos outros usuários da igreja; não remova a autenticação da aplicação.

## Relatar vulnerabilidade

Comunique ao responsável pelo repositório em canal privado. Não publique dados reais, credenciais, dumps ou detalhes exploráveis em issues públicas. Configure GitHub Private Vulnerability Reporting quando disponível.
