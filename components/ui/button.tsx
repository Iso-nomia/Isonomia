"use client";


import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium  transition-colors ",
  {
    variants: {
      variant: {
        default:
          "flex px-3 py-1 items-center btnv2--ghostabove border-slate-800 rounded-lg text-xs gap-2 ",
        destructive:
          "!bg-white text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground  !important",
        secondary: "!bg-white text-secondary-foreground hover:bg-secondary/80",
        ghostlegacy: "border-black outline-black hover:shadow-none ",
        link: "text-primary underline-offset-4 hover:underline",
        iconic: "bg-transparent border-none",
        btnv2: "flex px-3 py-1 btnv2 rounded-lg text-xs gap-2 bg-white/50",
        ghost: "flex px-3 py-1 items-center btnv2--ghost rounded-lg text-xs gap-2 bg-white/50",
        customize:"bg-white bg-opacity-30",
        whiteborder:
          "bg-white text-black border border-black border-[0.5px] rounded-[2px] hover:bg-slate-100",
      },
      size: {
        default: "h-4 rounded-md px-4 py-4",
        sm: "h-9 rounded-none px-3",
        lg: "h-11 rounded-sm px-8",
        icon: "h-10 w-10",
      },
      btype: {
        save: "relative right-[1px] top-[6px]",
        delete: "relative -right-[1px] top-[6px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      btype: "save",
    },
  }
);


export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  btype?: "delete" | "save";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, btype, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, btype, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
