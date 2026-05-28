interface ValidationMessagesProps {
  errorCount: number
}

export function ValidationMessages({ errorCount }: ValidationMessagesProps) {
  if (errorCount === 0) return null

  return (
    <span className="mr-auto text-[11px] text-rose-400/80">
      {errorCount} {errorCount === 1 ? 'error' : 'errors'}
    </span>
  )
}
