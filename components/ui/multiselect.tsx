"use client";

import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { OptionType } from "@/lib/MultiSelectFunctions";
import { Command as CommandPrimitive } from "cmdk";
import { X } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props<T extends OptionType> {
  fetchMultiselectData: (query: string) => Promise<T[]>;
  submitEdits: (selectables: T[]) => void;
  initialSelected: T[];
  allowNew?: boolean;
  onCreateOption?: (label: string) => T;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function FancyMultiSelect<T extends OptionType>({
  fetchMultiselectData,
  initialSelected,
  submitEdits,
  allowNew = false,
  onCreateOption,
}: Props<T>) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<T[]>(initialSelected);
  const [inputValue, setInputValue] = useState<string>("");
  const [selectables, setSelectables] = useState<T[]>([]);

  useEffect(() => {
    setOpen(true);
    inputRef.current?.focus();
  }, []);

 useEffect(() => {
  if (selected.length === 0) {
    return;
  }
  console.log("HEYYY");
  submitEdits(selected);
}, [selected, submitEdits]);

  const handleInputChange = (value: string | null) => {
    setInputValue(value ?? "");
  };
  const debouncedSearchTerm = useDebounce<string>(inputValue, 500);

const fetchAndSetSelectables = useCallback(async (query: string) => {
  if (query.length < 1) {
    setSelectables([]);
    return;
  }
  const data = await fetchMultiselectData(query);
  setSelectables(data.slice(0, 10));
}, [fetchMultiselectData]);

  const handleUnselect = useCallback((selectedValue: T) => {
    setSelected((prev) => prev.filter((s) => s.value !== selectedValue.value));
  }, []);

  const handleAddOption = useCallback(() => {
    if (!inputValue.trim()) {
      return;
    }
    const label = inputValue.trim();
    const option = onCreateOption
      ? onCreateOption(label)
      : ({ label, value: label } as T);
    setInputValue("");
    setSelected((prev) => [...prev, option]);
  }, [inputValue, onCreateOption]);


useEffect(() => {
  if (debouncedSearchTerm) {
    fetchAndSetSelectables(debouncedSearchTerm);
  } else {
    setSelectables([]);
  }
}, [debouncedSearchTerm, fetchAndSetSelectables]);

useEffect(() => {
  if (inputValue) {
    fetchAndSetSelectables(inputValue);
  } else {
    setSelectables([]);
  }
}, [inputValue, fetchAndSetSelectables]);

  useEffect(() => {
    let isActive = true;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        isActive &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      isActive = false;
    };
  }, [dropdownRef]);



  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (input) {
        if (e.key === "Delete" || e.key === "Backspace") {
          if (input.value === "") {
            setSelectables((prev) => {
              const newSelected = [...prev];
              newSelected.pop();
              return newSelected;
            });
          }
        }
        if (e.key === "Escape") {
          input.blur();
          setOpen(false);
        }
      }
    },
    []
  );

  const toggleDropdownOn = () => {
    setOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const toggleDropdownOff = () => {
    setOpen(false);
    setTimeout(() => {
      inputRef.current?.blur();
    }, 0);
  };

  const handleFocus = () => {
    setOpen(true);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 100);
  };

  return (
    <Command
      onKeyDown={handleKeyDown}
      className="overflow-visible  bg-transparent ring-black outline-black border-none  rounded-md"
    >
      <div className="bg-transparent mt-6   ">
        <CommandPrimitive.Input
          ref={inputRef}
          value={inputValue}
          onValueChange={handleInputChange}
          placeholder="Search..."
          className="grid px-3 py-3 bg-white rounded-md  shadow-inner shadow-slate-600 w-full placeholder:text-black 
          focus:outline focus:outline-2 focus:outline-blue "
          onClick={toggleDropdownOn}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {open && (
          <div className="absolute  w-[46.35rem]  mt-[1.47rem] bg-black text-white rounded-md">
            <CommandList>
              {(selectables.length > 0 || (allowNew && inputValue.trim().length > 0)) ? (
                <div className="absolute right-[.55rem]  top-[-.4rem] z-10 w-full rounded-md bg-popover text-popover-foreground animate-in">
                  <CommandGroup
                    className="visible  outline outline-1 outline-blue bg-blend-screen multiselect-dropdown ml-2 mr-2 mt-[-1.3rem] max-h-[9rem]
                shadow-slate-500 shadow-lg text-white bg-black overflow-y-auto"
                  >
                    {selectables.map((selectable) => (
                      <CommandItem
                        key={selectable.value}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onSelect={() => {
                          if (
                            !selected.some(
                              (selectedOption) =>
                                selectedOption.value === selectable.value
                            )
                          ) {
                            setInputValue("");
                            setSelected((prev) => [...prev, selectable]);
                          }
                        }}
                        className="cursor-pointer relative right-1 w-[102%] bottom-1 dropdown-divider rounded-none hover:bg-slate-600"
                      >
                      {selectable.label}
                      </CommandItem>
                    ))}
                    {allowNew && inputValue.trim().length > 0 &&
                      !selectables.some(
                        (s) => s.label.toLowerCase() === inputValue.trim().toLowerCase()
                      ) && (
                        <CommandItem
                          key="add-new"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onSelect={handleAddOption}
                          className="cursor-pointer relative right-1 w-[102%] bottom-1 dropdown-divider rounded-none hover:bg-slate-600"
                        >
                          {`Add "${inputValue.trim()}"`}
                        </CommandItem>
                      )}
                  </CommandGroup>
                </div>
              ) : null}
            </CommandList>
          </div>
        )}
      </div>
      <div
        onClick={toggleDropdownOff}
        className="group bg-white mr-0 ml-0 mt-6 mb-[-2rem] h-[12rem] rounded-md text-sm"
      >
        <div className=" px-2 py-2 bg-transparent flex  gap-0   ml-0  max-h-[12rem] overflow-auto">
          <div
            className="flex flex-wrap flex-grid  gap-x-[.6rem] pt-2 pb-1 pl-1 pr-1 gap-y-4 shadow-inner overflow-y-auto "
            style={{ maxHeight: "10rem", flexGrow: 0 }}
            onClick={toggleDropdownOff}
          >
            {selected.map((selectable) => {
              return (
                <Badge
                  key={selectable.value}
                  className="outline outline-2 outline-black "
                  variant="outline"
                >
                  {selectable.label}
                  <button
                    className="ml-2 bg-transparent rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUnselect(selectable);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={() => handleUnselect(selectable)}
                  >
                    <X className="h-3 w-3 items-center text-black hover:text-foreground" />
                  </button>
                </Badge>
              );
            })}
          </div>
        </div>
      </div>
    </Command>
  );
}
