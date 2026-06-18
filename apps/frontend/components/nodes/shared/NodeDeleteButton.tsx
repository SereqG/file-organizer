import { LuTrash2 } from 'react-icons/lu'

interface Props {
  onClick: (e: React.MouseEvent) => void
}

export function NodeDeleteButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-red-500/60 bg-[#111] text-red-400/70 transition-transform hover:scale-110 hover:shadow-[0_0_8px_rgba(239,68,68,0.45)]"
      aria-label="Delete node"
    >
      <LuTrash2 size={10} />
    </button>
  )
}
