
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "./scroll-area"

type ComboboxProps = {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  notfoundtext?: string;
}

export function Combobox({ options, value, onChange, placeholder = "Select an option", notfoundtext = "No option found." }: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  
  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? "" : currentValue;
    onChange(newValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
          {value
            ? options.find((option) => option.value === value)?.label ?? value
            : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={(value, search) => {
          const option = options.find(o => o.value === value);
          if (option) {
            return option.label.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }
          return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
        }}>
          <CommandInput 
            placeholder="Search or add new..."
          />
          <CommandList>
            <CommandEmpty>
                <CommandItem onSelect={() => handleSelect(document.querySelector<HTMLInputElement>('input[cmdk-input]')?.value || '')}>
                  {notfoundtext}
                </CommandItem>
            </CommandEmpty>
            <CommandGroup>
              <ScrollArea className="h-72">
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
