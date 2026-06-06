# OrbitGuard AI — Frontend (React + Vite + TypeScript)

Dashboard "mission control" geoespacial. Visual fiel ao `visual.html` (tema dark, terminal-cyan, JetBrains Mono, Material Symbols), portado para componentes React com dados reais do backend.

## Rodar

```powershell
npm install
npm run dev        # http://localhost:5173
npm run build      # checagem TS + bundle de produção
```

Aponta para o backend em `http://localhost:8000` por padrão. Para outra URL, crie `.env`:

```
VITE_API_URL=http://localhost:8077
```

## Layout / componentes

| Área | Componente | Dados |
|---|---|---|
| Topo | `TopNavBar` | health, "Atualizar Dados" (/ingest), "Recalcular Risco" (/risk) |
| Lateral | `SideNavBar` | navegação (rail colapsável) |
| Centro | `MapView` | Leaflet dark + focos coloridos por risco + HUD + legenda |
| Direita | `RiskMatrix` + `LiveDetectionFeed` | /risk, /alerts, /events |
| Base | `ReportView` + `ChatAgent` | /report/{id}, /chat (RAG com fontes) |

Estado central em `hooks/useDashboard.ts`; chamadas em `services/api.ts`; tema em `tailwind.config.js`.
