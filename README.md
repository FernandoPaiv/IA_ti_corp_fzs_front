# IA_ti_corp_fzs_front
Repositório para armazenar uma aplicação fzs do grilo do front

## Deploy (Vercel) — site estático

Hoje o front é um **arquivo único** (`main.html`) servido direto da raiz, sem
build. O `vercel.json` já declara isso (`framework: null`, sem build, output
`"."`).

Se o deploy falhar com **"No Output Directory named `public` found"**, a
configuração do dashboard está sobrepondo o arquivo. Ajuste no painel do projeto
na Vercel (Settings → Build & Development Settings):

- **Framework Preset:** `Other`
- **Build Command:** vazio (Override **desligado**)
- **Output Directory:** vazio (Override **desligado**)
- **Install Command:** vazio (Override **desligado**)
- **Root Directory:** raiz do repositório (deixe em branco)

Depois disso, o site é servido em `/` → `main.html`.

> Alvo final (ADR-001 §2): migrar para **Vite + React + Tailwind**, quando o
> output passará a ser `dist` e o `outputDirectory` do `vercel.json` deverá ser
> trocado para `"dist"` (ou removido, já que o Vite é detectado automaticamente).

## URLs (front ↔ back)

Os dois projetos se enxergam por URL. Mantenha-as em sincronia:

| Lado | Papel | Valor |
| --- | --- | --- |
| Front | URL pública | `https://ia-ti-corp-fzs-front-git-main-fezes-team.vercel.app` |
| Back | URL pública | `https://ia-ti-corp-fzsbackend.vercel.app` |

- **Front → Back:** o `main.html` detecta o ambiente (`localhost` = dev) e usa
  `API_BASE` conforme o host. Em produção chama o back da Vercel; em dev chama
  `http://localhost:3000`. Sem URL hardcoded de localhost no deploy.
- **Back → Front (CORS):** o back lê `FRONTEND_ORIGIN`. Esse valor precisa ser
  **a URL do front em produção** nas Environment Variables do projeto **back** na
  Vercel (não `localhost`). Sem isso, o navegador bloqueia a chamada por CORS.
