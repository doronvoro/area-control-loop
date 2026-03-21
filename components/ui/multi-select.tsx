"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, XIcon, MinusIcon } from "lucide-react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { ENTIRE_AREA, ENTIRE_AREA_DISPLAY } from "@/lib/constants"

interface MultiSelectOption {
  value: string
  label: string
  /** Short name for tree node display. Falls back to label if not provided. */
  shortLabel?: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  selectAllLabel?: string
  showSelectAll?: boolean
  disabled?: boolean
  className?: string
  /** Maps option value → parent option value. null/undefined = root level. */
  parentMap?: Record<string, string | null>
  /** Maps option value → depth level (0-based). Used for tree indentation. */
  levelMap?: Record<string, number>
}

function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  selectAllLabel = "בחר את כל השטח",
  showSelectAll = true,
  disabled = false,
  className,
  parentMap,
  levelMap,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  // Focus search input when popover opens
  React.useEffect(() => {
    if (open) {
      setSearchQuery("")
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
  }, [open])

  const isEntireAreaSelected = value.includes(ENTIRE_AREA)
  const isTreeMode = !!parentMap

  // Build children lookup from parentMap
  const childrenMap = React.useMemo(() => {
    const map: Record<string, string[]> = {}
    if (!parentMap) return map
    for (const [childValue, parentValue] of Object.entries(parentMap)) {
      if (parentValue) {
        if (!map[parentValue]) map[parentValue] = []
        map[parentValue].push(childValue)
      }
    }
    return map
  }, [parentMap])

  // Build tree-ordered options list (depth-first)
  const treeOrderedOptions = React.useMemo(() => {
    if (!parentMap) return options
    const optionMap = new Map(options.map((o) => [o.value, o]))
    const roots = options.filter((o) => !parentMap[o.value])
    const result: MultiSelectOption[] = []
    const addWithChildren = (opt: MultiSelectOption) => {
      result.push(opt)
      const children = (childrenMap[opt.value] || [])
        .map((v) => optionMap.get(v))
        .filter(Boolean) as MultiSelectOption[]
      children.forEach(addWithChildren)
    }
    roots.forEach(addWithChildren)
    return result
  }, [options, parentMap, childrenMap])

  // Initialize expanded nodes — start fully collapsed
  React.useEffect(() => {
    setExpandedNodes(new Set())
  }, [parentMap, childrenMap])

  // Get all descendant values of a parent (recursive)
  const getDescendants = React.useCallback((parentValue: string): string[] => {
    const children = childrenMap[parentValue] || []
    const descendants: string[] = [...children]
    for (const child of children) {
      descendants.push(...getDescendants(child))
    }
    return descendants
  }, [childrenMap])

  // Check if an option has children
  const hasChildren = React.useCallback((optionValue: string): boolean => {
    return (childrenMap[optionValue]?.length ?? 0) > 0
  }, [childrenMap])

  // Check if an option is visible (all ancestors expanded)
  const isVisible = React.useCallback((optionValue: string): boolean => {
    if (!parentMap) return true
    let current = parentMap[optionValue]
    while (current) {
      if (!expandedNodes.has(current)) return false
      current = parentMap[current] ?? null
    }
    return true
  }, [parentMap, expandedNodes])

  // Check if an option is visually checked (directly selected, or covered by parent/entire-area)
  const isVisuallyChecked = React.useCallback((optionValue: string): boolean => {
    if (isEntireAreaSelected) return true
    if (value.includes(optionValue)) return true
    // Check if any ancestor is selected
    if (parentMap) {
      let current = parentMap[optionValue]
      while (current) {
        if (value.includes(current)) return true
        current = parentMap[current] ?? null
      }
    }
    return false
  }, [value, isEntireAreaSelected, parentMap])

  // Check if parent is in indeterminate state (some but not all descendants checked)
  const isIndeterminate = React.useCallback((optionValue: string): boolean => {
    if (isEntireAreaSelected) return false
    if (value.includes(optionValue)) return false
    const descendants = getDescendants(optionValue)
    if (descendants.length === 0) return false
    const checkedCount = descendants.filter((d) => isVisuallyChecked(d)).length
    return checkedCount > 0 && checkedCount < descendants.length
  }, [value, isEntireAreaSelected, getDescendants, isVisuallyChecked])

  const handleEntireArea = () => {
    if (isEntireAreaSelected) {
      onValueChange([])
    } else {
      onValueChange([ENTIRE_AREA])
    }
  }

  const toggleExpand = (optionValue: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(optionValue)) {
        next.delete(optionValue)
      } else {
        next.add(optionValue)
      }
      return next
    })
  }

  const handleToggle = (optionValue: string) => {
    // If entire area is selected and user clicks an individual, switch to specific selection
    if (isEntireAreaSelected) {
      // Deselect entire area, select all options EXCEPT the one being toggled off
      const allExcept = options
        .filter((o) => o.value !== optionValue)
        .map((o) => o.value)
      // Consolidate: if all children of a parent are in the list, use parent instead
      onValueChange(consolidateValues(allExcept))
      return
    }

    const currentlyChecked = isVisuallyChecked(optionValue)

    if (currentlyChecked) {
      // Unchecking
      if (value.includes(optionValue)) {
        // Directly selected - just remove it
        let newValue = value.filter((v) => v !== optionValue)
        // Also remove any descendants that might be selected
        const descendants = getDescendants(optionValue)
        newValue = newValue.filter((v) => !descendants.includes(v))
        onValueChange(newValue)
      } else {
        // Covered by a parent - need to "break" the parent selection
        // Find which ancestor is selected
        let ancestorValue: string | null = parentMap?.[optionValue] ?? null
        let selectedAncestor: string | null = null
        while (ancestorValue) {
          if (value.includes(ancestorValue)) {
            selectedAncestor = ancestorValue
            break
          }
          ancestorValue = parentMap?.[ancestorValue] ?? null
        }
        if (selectedAncestor) {
          // Remove the ancestor, add all its descendants EXCEPT the one being unchecked
          const descendants = getDescendants(selectedAncestor)
          const siblings = descendants.filter((d) => d !== optionValue)
          let newValue = value.filter((v) => v !== selectedAncestor)
          newValue = [...newValue, ...siblings]
          // Re-consolidate in case some groups are now complete
          onValueChange(consolidateValues(newValue))
        }
      }
    } else {
      // Checking - add the option
      let newValue = [...value, optionValue]

      // If this is a parent, remove individually-selected children (parent covers them)
      if (hasChildren(optionValue)) {
        const descendants = getDescendants(optionValue)
        newValue = newValue.filter((v) => !descendants.includes(v))
      }

      // Consolidate: check if all siblings are now selected → promote to parent
      onValueChange(consolidateValues(newValue))
    }
  }

  // Consolidate selected values: if all children of a parent are selected, replace with parent
  const consolidateValues = React.useCallback((values: string[]): string[] => {
    if (!parentMap) return values
    let result = [...values]
    let changed = true

    while (changed) {
      changed = false
      // Find parents whose ALL children are in result
      for (const [parentValue, children] of Object.entries(childrenMap)) {
        if (result.includes(parentValue)) continue // Already consolidated
        if (children.length === 0) continue
        const allChildrenSelected = children.every((c) => result.includes(c))
        if (allChildrenSelected) {
          // Replace children with parent
          result = result.filter((v) => !children.includes(v))
          result.push(parentValue)
          changed = true
        }
      }
    }

    // Check if all root-level options are selected → promote to ENTIRE_AREA
    const rootOptions = options.filter((o) => !parentMap[o.value])
    const allRootsSelected = rootOptions.every((o) => result.includes(o.value))
    if (allRootsSelected && rootOptions.length > 0) {
      return [ENTIRE_AREA]
    }

    return result
  }, [parentMap, childrenMap, options])

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (optionValue === ENTIRE_AREA) {
      onValueChange([])
    } else {
      handleToggle(optionValue)
    }
  }

  // Compute display labels
  const selectedLabels = React.useMemo(() => {
    if (isEntireAreaSelected) return [ENTIRE_AREA_DISPLAY]
    return value
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean) as string[]
  }, [value, isEntireAreaSelected, options])

  // Compute "select all" checkbox state
  const someIndividualSelected = value.length > 0 && !isEntireAreaSelected

  const checkboxClassName = "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none"

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "multi-select-trigger border-input focus-visible:border-ring focus-visible:ring-ring/50 flex w-full items-center justify-between rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
            {value.length === 0 && (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            {value.length > 0 && value.length <= 2 && (
              selectedLabels.map((label, i) => (
                <span
                  key={value[i]}
                  className="multi-select-badge"
                >
                  <span className="truncate max-w-[10rem]">{label}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    className="multi-select-badge-remove"
                    onClick={(e) => handleRemove(value[i], e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleRemove(value[i], e as unknown as React.MouseEvent)
                      }
                    }}
                  >
                    <XIcon className="size-3" />
                  </span>
                </span>
              ))
            )}
            {value.length > 2 && (
              <span className="multi-select-badge">
                {isEntireAreaSelected ? ENTIRE_AREA_DISPLAY : `${value.length} נבחרו`}
              </span>
            )}
          </div>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="multi-select-popover">
          {/* Search input */}
          <div className="px-2 pt-2 pb-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש..."
              className="w-full px-2.5 py-1.5 text-sm border rounded-md outline-none focus:ring-1 focus:ring-ring bg-background"
            />
          </div>

          <div className="multi-select-options">
          {/* Select Entire Area */}
          {showSelectAll && !searchQuery && (
            <>
              <label className="multi-select-item multi-select-item-all">
                <CheckboxPrimitive.Root
                  className={cn(checkboxClassName)}
                  checked={isEntireAreaSelected ? true : someIndividualSelected ? "indeterminate" : false}
                  onCheckedChange={handleEntireArea}
                >
                  <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
                    {someIndividualSelected && !isEntireAreaSelected ? (
                      <MinusIcon className="size-3.5" />
                    ) : (
                      <CheckIcon className="size-3.5" />
                    )}
                  </CheckboxPrimitive.Indicator>
                </CheckboxPrimitive.Root>
                <span className="font-semibold text-sm">{selectAllLabel}</span>
              </label>

              {/* Divider */}
              <div className="bg-border -mx-0 my-1 h-px" />
            </>
          )}

          {/* Options — tree or flat */}
          {treeOrderedOptions.filter((option) => {
            if (!searchQuery) return true
            return option.label.toLowerCase().includes(searchQuery.toLowerCase())
          }).map((option) => {
            const checked = isVisuallyChecked(option.value)
            const indeterminate = isIndeterminate(option.value)
            const isParent = hasChildren(option.value)
            // Disable if entire area selected OR if a parent/ancestor is directly selected
            const ancestorSelected = (() => {
              if (!parentMap) return false
              let cur = parentMap[option.value]
              while (cur) {
                if (value.includes(cur)) return true
                cur = parentMap[cur] ?? null
              }
              return false
            })()
            const itemDisabled = isEntireAreaSelected || ancestorSelected
            const level = levelMap?.[option.value] ?? 0
            const visible = isTreeMode ? isVisible(option.value) : true
            const expanded = expandedNodes.has(option.value)
            const displayLabel = isTreeMode ? (option.shortLabel || option.label) : option.label

            if (!visible) return null

            return (
              <label
                key={option.value}
                className={cn(
                  "multi-select-item",
                  isParent && "font-medium",
                  itemDisabled && "opacity-50 pointer-events-none"
                )}
                style={isTreeMode && level > 0 ? { paddingInlineStart: `${0.625 + level * 1.25}rem` } : undefined}
              >
                {/* Expand/collapse toggle for parent nodes */}
                {isTreeMode && isParent && (
                  <span
                    role="button"
                    tabIndex={-1}
                    className="multi-select-tree-toggle"
                    onClick={(e) => toggleExpand(option.value, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        toggleExpand(option.value, e as unknown as React.MouseEvent)
                      }
                    }}
                  >
                    {expanded ? (
                      <ChevronDownIcon className="size-3.5" />
                    ) : (
                      <ChevronLeftIcon className="size-3.5" />
                    )}
                  </span>
                )}
                {/* Spacer for leaf nodes in tree mode to align with parents */}
                {isTreeMode && !isParent && parentMap?.[option.value] && (
                  <span className="w-[1.25rem] shrink-0" />
                )}

                <CheckboxPrimitive.Root
                  className={cn(checkboxClassName)}
                  checked={checked ? (indeterminate ? "indeterminate" : true) : false}
                  onCheckedChange={() => handleToggle(option.value)}
                  disabled={itemDisabled}
                >
                  <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
                    {indeterminate ? (
                      <MinusIcon className="size-3.5" />
                    ) : (
                      <CheckIcon className="size-3.5" />
                    )}
                  </CheckboxPrimitive.Indicator>
                </CheckboxPrimitive.Root>
                <span className="truncate">{displayLabel}</span>
              </label>
            )
          })}
          </div>

          {/* Done button */}
          <div className="bg-border -mx-0 my-1 h-px" />
          <button
            type="button"
            className="w-full py-2 text-sm font-semibold text-primary hover:bg-accent transition-colors cursor-pointer"
            onClick={() => setOpen(false)}
          >
            סגור
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { MultiSelect }
export type { MultiSelectOption, MultiSelectProps }
