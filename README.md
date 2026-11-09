# Monorepo de exemplo: tiers de criticidade

Exemplo executável de monorepo com três serviços independentes. O objetivo é demonstrar que a criticidade pode influenciar operação, recuperação e prioridades de entrega — não apenas a estrutura de pastas.

## Componentes

| Tier | Componente | Impacto ilustrativo | Estratégia operacional ilustrativa |
|---|---|---|---|
| 1 — crítico | API de pedidos | Interrompe uma jornada principal do negócio | Reinício sempre ativo, verificações de saúde mais frequentes, prioridade máxima de recuperação e testes bloqueantes |
| 2 — importante | Notificações | Atrasos afetam a experiência, mas podem ser compensados | Reinício em caso de falha e recuperação após o tier 1 |
| 3 — baixo | Relatórios analíticos | Atrasos afetam análises, sem interromper a operação principal | Pode ser recuperado por último e operar com verificações menos frequentes |

Os serviços são exemplos sem banco de dados ou integrações externas. Os dados são estáticos em memória; reiniciar um container não restaura dados persistidos. Ajuste tiers e estratégias com base em uma análise real de impacto no negócio.

## Estrutura

```text
apps/
  dashboard/
  tier-1-api/
  tier-2-notifications/
  tier-3-analytics/
.github/workflows/ci.yml
docker-compose.yml
package.json
```

Cada aplicação tem seu próprio `package.json`, servidor HTTP, testes e `Dockerfile`. O pacote raiz coordena os workspaces npm.

## Executar localmente

Requer Node.js 20 ou superior. Não há dependências de terceiros.

```sh
npm test
npm run start:tier-1
npm run start:tier-2
npm run start:tier-3
```

No PowerShell do Windows, use `npm.cmd` caso a política de execução bloqueie `npm`:

```powershell
npm.cmd test
npm.cmd run start:tier-1
```

Execute cada serviço em um terminal separado. Eles usam as portas `3001`, `3002` e `3003`, respectivamente. Exemplos de endpoints:

```text
GET http://localhost:3001/
GET http://localhost:3001/healthz
GET http://localhost:3001/orders
GET http://localhost:3002/notifications
GET http://localhost:3003/reports/summary
```

### Dashboard ilustrativo

Inicie o painel em outro terminal:

```powershell
npm.cmd run start:dashboard
```

Abra `http://localhost:3000`. O painel consulta os healthchecks reais dos serviços a cada 5 segundos; para mostrar todos como online, inicie também os três serviços em terminais separados. O botão **Simular falha do Tier 1** apresenta visualmente a falha e preserva os estados operacionais dos outros tiers. Essa demonstração é visual e não interrompe processos; os indicadores “Real” continuam mostrando a disponibilidade observada nos endpoints.

### Simular falha do Tier 1 mantendo o Tier 2 ativo

No terminal, a partir da pasta `monorepo`, execute:

```powershell
npm.cmd run simulate:tier-1-failure
```

Se o terminal estiver na pasta acima (`TrabalhoMonorepo`), use:

```powershell
npm.cmd --prefix .\monorepo run simulate:tier-1-failure
```

O supervisor inicia os serviços dos Tiers 1 e 2, aguarda ambos ficarem saudáveis e simula uma falha fatal no Tier 1. O Tier 2 continua em execução; pressione `Ctrl+C` para encerrá-lo e terminar a simulação. Use as portas `3001` e `3002` livres e não inicie esses serviços em outros terminais ao mesmo tempo.

Esse comportamento demonstra isolamento entre serviços: a falha no Tier 1 não derruba automaticamente o Tier 2. Em produção, os serviços devem tolerar falhas de dependências com timeouts, retries limitados e circuit breakers conforme a necessidade do negócio.

### Executar tudo com Docker

1. Instale o [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/).
2. Durante a instalação, use o backend WSL 2 se essa opção estiver disponível. Se o WSL ainda não estiver instalado, abra o PowerShell como administrador, execute `wsl --install` e reinicie o Windows quando solicitado.
3. Abra o Docker Desktop e espere até indicar que o mecanismo Docker está em execução.
4. No PowerShell, a partir da pasta `monorepo`, execute:

```powershell
docker compose up --build
```

O Compose inicia o painel e os três serviços, aguarda os healthchecks dos serviços e configura o painel para consultá-los pela rede interna do Docker. Acesse **http://localhost:3000**; as APIs permanecem disponíveis nas portas `3001`, `3002` e `3003`.

Para iniciar em segundo plano, use `docker compose up --build -d`. Consulte os logs com `docker compose logs -f` e encerre/remova os containers com `docker compose down`. Se executar o comando a partir da pasta principal do projeto, use `docker compose -f .\monorepo\docker-compose.yml up --build`. Evite iniciar a mesma stack simultaneamente com os comandos `npm`, porque as portas já estarão ocupadas.

## CI

O workflow de CI na raiz do repositório executa os testes dos três serviços deste exemplo antes de liberar a publicação.

## CD

Após uma execução bem-sucedida da CI em um push para `main`, o workflow `.github/workflows/cd.yml` publica as imagens dos três serviços no GitHub Container Registry (GHCR), em sequência de menor para maior criticidade: Tier 3, Tier 2 e Tier 1. Cada imagem recebe uma tag com o SHA do commit e a tag `latest`.

Para permitir a publicação, habilite a permissão de escrita de pacotes para o `GITHUB_TOKEN` nas configurações de Actions do repositório. As imagens ficam disponíveis em `ghcr.io/<proprietário>/<repositório>-tier-<n>-<serviço>`.

Este CD publica as imagens; ele não atualiza containers em um servidor. Um rollout em execução requer um destino de hospedagem, que não faz parte deste exemplo.

## Publicar o Dashboard na Netlify

O arquivo `netlify.toml` na raiz do repositório configura a Netlify para publicar `monorepo/apps/dashboard/public` e carregar as funções de `monorepo/netlify/functions`. Ele encaminha `/api/status` para uma Netlify Function. Ao importar o repositório, use a raiz do repositório como diretório-base e deixe o comando de build vazio.

Configure estas variáveis de ambiente no site da Netlify com as URLs públicas dos serviços hospedados (por exemplo, no Render):

| Variável | Serviço |
|---|---|
| `TIER_1_URL` | API de pedidos |
| `TIER_2_URL` | Notificações |
| `TIER_3_URL` | Analytics |

Use URLs `http://` ou `https://`, sem credenciais. A função acrescenta `/healthz`; o Dashboard usa as mesmas URLs nos links “Abrir API”. Se uma variável estiver ausente ou inválida, o serviço aparece offline e o link não é exibido. Depois de cadastrar ou alterar as variáveis, faça um novo deploy.

## Próximos passos para produção

- Definir SLOs, RTO e RPO com as áreas de negócio; este projeto não presume valores de produção.
- Adicionar persistência, backups e testes de restauração para dados importantes.
- Configurar alertas, métricas e logs centralizados por serviço e tier.
- Usar limites de recursos e políticas de escala coerentes com a carga e o impacto.
- Complementar os healthchecks de processo com verificações de dependências quando elas existirem.
- Proteger endpoints, configurar segredos fora do repositório e adicionar análise de dependências e imagens.
