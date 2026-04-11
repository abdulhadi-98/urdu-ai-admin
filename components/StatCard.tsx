'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'
  className?: string
}

const colorMap = {
  indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  green: 'bg-green-500/15 text-green-400 border-green-500/20',
  yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'indigo',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-dark-800 border border-dark-600 rounded-xl p-5 flex flex-col gap-3',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        <div className={cn('w-9 h-9 rounded-lg border flex items-center justify-center', colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {trend && (
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-medium',
              trend.positive !== false ? 'text-green-400' : 'text-red-400'
            )}
          >
            {trend.value > 0 ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs text-gray-500">{trend.label}</span>
        </div>
      )}
    </div>
  )
}
