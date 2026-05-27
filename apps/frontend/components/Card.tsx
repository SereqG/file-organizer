interface CardProps {
  children: React.ReactNode
}

export function Card({ children }: CardProps) {
  return (
    <div
      className="
        relative z-10 w-full max-w-4xl rounded-2xl p-10
        border border-white/[0.07]
        shadow-[0_0_100px_rgba(249,115,22,0.07),0_40px_80px_rgba(0,0,0,0.6)]
      "
      style={{ background: 'rgba(8, 8, 8, 0.88)', backdropFilter: 'blur(28px)' }}
    >
      {children}
    </div>
  )
}
