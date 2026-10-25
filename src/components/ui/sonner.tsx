"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * O `Toaster` do CLI, com **uma** linha desfeita: o `useTheme` do `next-themes`.
 *
 * O tema aqui é `prefers-color-scheme` puro (`globals.css`), sem provider — e o
 * CLI trouxe o `next-themes` junto com o sonner. Montar um provider só para o
 * toast saber o tema seria acrescentar um contexto de cliente ao layout inteiro
 * para responder o que o navegador já responde. `theme="system"` é exatamente
 * essa resposta, e é o que o `useTheme` devolveria de qualquer jeito.
 *
 * O resto — ícones, tokens de cor, raio — é o do base-nova, intocado.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
