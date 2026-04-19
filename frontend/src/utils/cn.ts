// Função simples para combinar classes CSS sem dependências externas
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
} 