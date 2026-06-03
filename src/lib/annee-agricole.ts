// L'année agricole va du 01/07 au 30/06

export function getAnneeAgricole(date: Date = new Date()) {
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  if (month >= 7) {
    return { debut: new Date(year, 6, 1), fin: new Date(year + 1, 5, 30) }
  }
  return { debut: new Date(year - 1, 6, 1), fin: new Date(year, 5, 30) }
}

export function getAnneeAgricoleLabel(date: Date = new Date()) {
  const { debut, fin } = getAnneeAgricole(date)
  return `${debut.getFullYear()}/${fin.getFullYear()}`
}

export function isInAnneeAgricole(dateStr: string, anneeDebut?: Date): boolean {
  const date = new Date(dateStr)
  const { debut, fin } = anneeDebut ? { debut: anneeDebut, fin: new Date(anneeDebut.getFullYear() + 1, 5, 30) } : getAnneeAgricole()
  return date >= debut && date <= fin
}

export function getAnneeAgricoleISO(date: Date = new Date()) {
  const { debut, fin } = getAnneeAgricole(date)
  return {
    debut: debut.toISOString().split('T')[0],
    fin: fin.toISOString().split('T')[0],
  }
}

export function formatMois(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

export function formatTonnes(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' t'
}

export function formatEuros(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function formatEurosParTonne(n?: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €/t'
}
