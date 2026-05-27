import { WorkspaceSection } from '@/components/WorkspaceSection'

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-start justify-center bg-black overflow-hidden px-6 py-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 30%, rgba(249,115,22,0.07) 0%, transparent 65%)',
        }}
      />
      <WorkspaceSection />
    </div>
  )
}
