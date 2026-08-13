<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI: shadcn no estilo `base-nova`

Componente de catálogo **vem pelo CLI**, nunca copiado à mão do site:
`npx shadcn@latest add <nome>`. O `components.json` é a fonte e é o mesmo do bdsolutions
(`base-nova`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`, `rsc: true`) — não
divergir. O CLI gera o import do `@base-ui/react` **sem** instalar o pacote; se o `tsc` acusar
`TS2307`, é isso.

Componente de domínio (o que o shadcn não tem) segue o padrão da casa: variantes por `cva` com o
`xxxVariants` exportado, `cn()` para juntar a classe interna com a `className` recebida,
`React.ComponentProps<'elemento'>` na base do tipo, `data-slot` em cada parte estilizável, e sem
`forwardRef` — no React 19 `ref` é prop comum.

A **aparência é nossa**, não do `base-nova`: `variant={null}` / `size={null}` desligam a paleta de lá
e as classes da §3.1 do `docs/superpowers/design/2026-08-07-direcao-de-ui.md` mandam. Leia a §4.1
antes de trocar isso — ela registra o que veio de fora, o que ficou nosso e as três armadilhas de
camada e de `tailwind-merge` que já custaram caro.
