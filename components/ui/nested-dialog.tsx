"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

/**
 * NestedDialog - A Dialog component with elevated z-index for nested modal scenarios
 * 
 * Use this when you need to display a modal on top of another modal.
 * It automatically applies z-70 to both overlay and content to ensure proper layering.
 * 
 * Example use cases:
 * - Submit Response form inside CQ modal
 * - Endorse modal inside CQ Responses List
 * - Any modal triggered from within another modal
 * 
 * Usage:
 * ```tsx
 * <NestedDialog open={open} onOpenChange={setOpen}>
 *   <NestedDialogContent className="max-w-2xl">
 *     <DialogHeader>
 *       <DialogTitle>Nested Modal Title</DialogTitle>
 *     </DialogHeader>
 *     // ... your content
 *   </NestedDialogContent>
 * </NestedDialog>
 * ```
 */

const NestedDialog = Dialog

const NestedDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, children, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={`!z-[70] ${className || ""}`}
    overlayClassName="!z-[70]"
    {...props}
  >
    {children}
  </DialogContent>
))
NestedDialogContent.displayName = "NestedDialogContent"

// Re-export DialogHeader, DialogTitle, etc. for convenience
const NestedDialogHeader = DialogHeader
const NestedDialogTitle = DialogTitle
const NestedDialogDescription = DialogDescription
const NestedDialogFooter = DialogFooter

export {
  NestedDialog,
  NestedDialogContent,
  NestedDialogHeader,
  NestedDialogTitle,
  NestedDialogDescription,
  NestedDialogFooter,
}
