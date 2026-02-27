"use client"

import * as React from "react"
import { ChevronDownIcon, XIcon, MinusIcon } from "lucide-react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"

interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  selectAllLabel?: string
  disabled?: boolean
  className?: string
}

function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  selectAllLabel = "בחר הכל",
  disabled = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const allSelected = options.length > 0 && value.length === options.length
  const someSelected = value.length > 0 && value.length < options.length

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue))
    } else {
      onValueChange([...value, optionValue])
    }
  }

  const handleSelectAll = () => {
    if (allSelected) {
      onValueChange([])
    } else {
      onValueChange(options.map((o) => o.value))
    }
  }

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(value.filter((v) => v !== optionValue))
  }

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean) as string[]

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
                {value.length} נבחרו
              </span>
            )}
          </div>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <div className="multi-select-popover">
          {/* Select All */}
          <label className="multi-select-item multi-select-item-all">
            <CheckboxPrimitive.Root
              className={cn(
                "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=checked]:border-primary data-[state=indeterminate]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none"
              )}
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={handleSelectAll}
            >
              <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
                {someSelected ? (
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

          {/* Options */}
          {options.map((option) => {
            const isSelected = value.includes(option.value)
            return (
              <label key={option.value} className="multi-select-item">
                <CheckboxPrimitive.Root
                  className={cn(
                    "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none"
                  )}
                  checked={isSelected}
                  onCheckedChange={() => handleToggle(option.value)}
                >
                  <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
                    <CheckIcon className="size-3.5" />
                  </CheckboxPrimitive.Indicator>
                </CheckboxPrimitive.Root>
                <span className="truncate">{option.label}</span>
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { MultiSelect }
export type { MultiSelectOption, MultiSelectProps }
