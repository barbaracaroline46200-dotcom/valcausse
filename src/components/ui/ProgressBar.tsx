import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  total: number
  className?: string
  showLabel?: boolean
}

export default function ProgressBar({ value, total, className, showLabel = true }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  // Dégradé de couleurs Valcausse : or → brun selon avancement
  const color = pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-green-400' : pct >= 30 ? '[background-color:#C8941A]' : 'bg-gray-200'
  const style = pct >= 30 && pct < 70 ? { backgroundColor: '#C8941A' } : pct < 30 ? {} : {}

  return (
    <div className={cn('space-y-1', className)}>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-green-400' : pct < 30 ? 'bg-gray-200' : '')}
          style={{
            width: `${pct}%`,
            ...(pct >= 30 && pct < 70 ? { backgroundColor: '#C8941A' } : {}),
            ...(pct >= 70 && pct < 100 ? { backgroundColor: '#7B2820' } : {}),
          }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500">
          <span>{value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} t livrées</span>
          <span className="font-medium">{pct.toFixed(0)}%</span>
        </div>
      )}
    </div>
  )
}
