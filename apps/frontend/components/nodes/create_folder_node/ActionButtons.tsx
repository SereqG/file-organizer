interface ActionButtonsProps {
  onCancel: () => void
  onSave: () => void
  saveDisabled: boolean
}

export function ActionButtons({ onCancel, onSave, saveDisabled }: ActionButtonsProps) {
  return (
    <>
      <button
        onClick={onCancel}
        className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white/90"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saveDisabled}
        className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-xs text-sky-300 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save
      </button>
    </>
  )
}
