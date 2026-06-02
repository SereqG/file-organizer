'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import type React from 'react'
import type { FileTreeNode } from '@/lib/types/explore'

interface Options {
  root: FileTreeNode
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelect?: (node: FileTreeNode) => void
  filter?: (node: FileTreeNode) => boolean
}

export function useTreeKeyboardNav({ root, expandedIds, onToggle, onSelect, filter }: Options) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  const visibleNodes = useMemo(
    () => flattenVisible(root, expandedIds, filter),
    [root, expandedIds, filter]
  )

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      itemRefs.current.set(id, el)
    } else {
      itemRefs.current.delete(id)
    }
  }, [])

  function focusItem(id: string) {
    setFocusedId(id)
    itemRefs.current.get(id)?.focus()
  }

  function handleItemKeyDown(e: React.KeyboardEvent, node: FileTreeNode) {
    const idx = visibleNodes.findIndex(n => n.id === node.id)
    const isDir = node.type === 'directory'
    const isExpanded = expandedIds.has(node.id)
    const isSkipped = node.skipped === true

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (idx < visibleNodes.length - 1) focusItem(visibleNodes[idx + 1].id)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (idx > 0) focusItem(visibleNodes[idx - 1].id)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (isDir && !isSkipped) {
          if (!isExpanded) {
            onToggle(node.id)
          } else {
            const firstChild = getFirstVisibleChild(node, filter)
            if (firstChild) focusItem(firstChild.id)
          }
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (isDir && isExpanded) {
          onToggle(node.id)
        } else {
          const parent = findParent(root, node.id, filter)
          if (parent) focusItem(parent.id)
        }
        break
      case 'Home':
        e.preventDefault()
        if (visibleNodes.length > 0) focusItem(visibleNodes[0].id)
        break
      case 'End':
        e.preventDefault()
        if (visibleNodes.length > 0) focusItem(visibleNodes[visibleNodes.length - 1].id)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (isSkipped) break
        if (onSelect && (!filter || filter(node))) {
          onSelect(node)
        } else if (isDir) {
          onToggle(node.id)
        }
        break
    }
  }

  function getTabIndex(id: string): number {
    if (focusedId === null) {
      return visibleNodes.length > 0 && visibleNodes[0].id === id ? 0 : -1
    }
    return id === focusedId ? 0 : -1
  }

  function onItemFocus(id: string) {
    setFocusedId(id)
  }

  return { focusedId, registerRef, handleItemKeyDown, getTabIndex, onItemFocus }
}

function flattenVisible(
  node: FileTreeNode,
  expandedIds: Set<string>,
  filter?: (n: FileTreeNode) => boolean
): FileTreeNode[] {
  const result: FileTreeNode[] = []

  function visit(n: FileTreeNode) {
    if (!filter || filter(n)) {
      result.push(n)
    }
    if (expandedIds.has(n.id) && n.children) {
      n.children.forEach(visit)
    }
  }

  visit(node)
  return result
}

function getFirstVisibleChild(node: FileTreeNode, filter?: (n: FileTreeNode) => boolean): FileTreeNode | null {
  if (!node.children) return null
  for (const child of node.children) {
    if (!filter || filter(child)) return child
  }
  return null
}

function findParent(
  root: FileTreeNode,
  targetId: string,
  filter?: (n: FileTreeNode) => boolean
): FileTreeNode | null {
  function search(node: FileTreeNode): FileTreeNode | null {
    if (!node.children) return null
    for (const child of node.children) {
      if (child.id === targetId) {
        return !filter || filter(node) ? node : null
      }
      const found = search(child)
      if (found) return found
    }
    return null
  }
  return search(root)
}
