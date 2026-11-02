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

Para executar todos os serviços em containers:

```sh
docker compose up --build
```

O Compose publica as mesmas portas e define healthchecks e políticas de reinício adequadas ao exemplo.

## CI

O workflow `.github/workflows/ci.yml` executa os testes de cada workspace em jobs separados. Todos os tiers bloqueiam a CI se os seus testes falharem; a criticidade define prioridades operacionais, não deve ser motivo para aceitar silenciosamente regressões.

## Próximos passos para produção

- Definir SLOs, RTO e RPO com as áreas de negócio; este projeto não presume valores de produção.
- Adicionar persistência, backups e testes de restauração para dados importantes.
- Configurar alertas, métricas e logs centralizados por serviço e tier.
- Usar limites de recursos e políticas de escala coerentes com a carga e o impacto.
- Complementar os healthchecks de processo com verificações de dependências quando elas existirem.
- Proteger endpoints, configurar segredos fora do repositório e adicionar análise de dependências e imagens.
