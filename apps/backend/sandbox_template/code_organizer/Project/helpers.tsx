import React from 'react'

interface ButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
}

export function PrimaryButton({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
    >
      {label}
    </button>
  )
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
