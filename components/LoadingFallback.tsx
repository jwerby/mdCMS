import { Loader2 } from 'lucide-react'

interface LoadingFallbackProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingFallback({
  message = 'Loading...',
  size = 'md'
}: LoadingFallbackProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }

  return (
    <div className="flex items-center justify-center min-h-[200px] w-full">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className={`${sizeClasses[size]} animate-spin`} />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}

export function FullPageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-4 text-slate-600">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <span className="text-lg font-medium">{message}</span>
      </div>
    </div>
  )
}
