const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
]
const DIZAINES: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' }

function deuxChiffres(n: number): string {
  if (n < 20) return UNITES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  if (d === 7 || d === 9) {
    const base = d === 7 ? 'soixante' : 'quatre-vingt'
    if (u === 1 && d === 7) return `${base} et onze`
    return `${base}-${UNITES[10 + u]}`
  }
  if (u === 0) return d === 8 ? 'quatre-vingts' : DIZAINES[d]
  if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`
  return `${DIZAINES[d]}-${UNITES[u]}`
}

function troisChiffres(n: number): string {
  if (n === 0) return ''
  const c = Math.floor(n / 100)
  const r = n % 100
  let s = ''
  if (c > 0) {
    s += c === 1 ? 'cent' : `${UNITES[c]} cent`
    if (c > 1 && r === 0) s += 's'
    if (r > 0) s += ' '
  }
  if (r > 0) s += deuxChiffres(r)
  return s
}

/** Convertit un entier positif en toutes lettres (français traditionnel). */
export function nombreEnLettres(n: number): string {
  if (n === 0) return 'zéro'
  const milliards = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const milliers = Math.floor((n % 1e6) / 1e3)
  const reste = n % 1000
  const parts: string[] = []
  if (milliards > 0) parts.push(milliards === 1 ? 'un milliard' : `${troisChiffres(milliards)} milliards`)
  if (millions > 0) parts.push(millions === 1 ? 'un million' : `${troisChiffres(millions)} millions`)
  if (milliers > 0) parts.push(milliers === 1 ? 'mille' : `${troisChiffres(milliers)} mille`)
  if (reste > 0) parts.push(troisChiffres(reste))
  return parts.join(' ').trim()
}

/** Ex: 15.20 → "quinze euros et vingt centimes", 1 → "un euro" */
export function montantEnLettres(montant: number): string {
  const totalCentimes = Math.round(montant * 100)
  const euros = Math.floor(totalCentimes / 100)
  const centimes = totalCentimes % 100
  let s = `${nombreEnLettres(euros)} ${euros <= 1 ? 'euro' : 'euros'}`
  if (centimes > 0) {
    s += ` et ${nombreEnLettres(centimes)} ${centimes <= 1 ? 'centime' : 'centimes'}`
  }
  return s
}
