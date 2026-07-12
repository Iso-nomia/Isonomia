// components/ui/AnimatedDialog.tsx  ──────────────────────────────
"use client";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogClose,
} from "@/components/ui/dialog";
import { motion, AnimatePresence, Transition, useReducedMotion, easeInOut } from "framer-motion";
import { duration } from "html2canvas/dist/types/css/property-descriptors/duration";
import { PropsWithChildren } from "react";
import { ReactNode } from "react";

// interface Props {
//   open: boolean;
//   onOpenChange: (v: boolean) => void;
//   /** A stable id used both on the trigger and the content */
//   layoutId: string;
// }

// }
// export function AnimatedDialog({
//   open,
//   onOpenChange,
//   layoutId,
//   children,
// }: PropsWithChildren<Props>) {
//   return (
//     <Dialog open={open} onOpenChange={onOpenChange}>
//       <AnimatePresence>
//         {open && (
//           <>
//             <DialogOverlay asChild>
//               <motion.div
//                 initial={{ opacity: 0 }}
//                 animate={{ opacity: 0.6 }}
//                 exit={{ opacity: 0 }}
//                 transition={{ duration: 0.5 }}
//                 className="fixed inset-0 bg-black"
//               />
//             </DialogOverlay>

//             <DialogContent asChild forceMount>
//               <motion.div
//                 layoutId={layoutId}
//                 initial={{ scale: 0, opacity: 0 }}
//                 animate={{ scale: 1,   opacity: 1 }}
//                 exit={{   scale: 0, opacity: 0 }}
//                 transition={{
//                   type: "spring",
//                   mass: .36,
//                   stiffness: 26,
//                   damping: .2,
//                 }}
//                 className="rounded-xl bg-white shadow-xl w-[90vw] max-w-lg"
//               >
//                 {children}
//                 <DialogClose className="absolute top-2 right-2"></DialogClose>
//               </motion.div>
//             </DialogContent>
//           </>
//         )}
//       </AnimatePresence>
//     </Dialog>
//   );
// }
interface Props {
  open: boolean;
  onOpenChange(v: boolean): void;
  children: ReactNode;
}
export function AnimatedDialog({ open, onOpenChange, children }: Props) {
  // Respect the user’s OS-level “reduce motion” preference
  const prefersReduced = useReducedMotion();

  /** ---------- spring config ---------- */
  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onOpenChange}>
                    {/* ───── backdrop ───── */}
                    <motion.div
            key="backdrop"
            className="fixed inset-0 bg-white bg-opacity-50 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{type:"tween", duration: .25 }}
          />
           {/* ───── content ───── */}
         <div>
            {children}
            </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
