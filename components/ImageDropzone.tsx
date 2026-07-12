// "use client";
// import { useRef, useState } from "react";
// import { cn } from "@/lib/utils";

// interface Props {
//   onFile: (file: File) => void;
// }

// export default function ImageDropzone({ onFile }: Props) {
//   const inputRef = useRef<HTMLInputElement | null>(null);
//   const [drag, setDrag] = useState(false);

//   const handleFile = (f: File | undefined) => {
//     if (f) onFile(f);
//   };

//   // return (
//   //   <div
//   //     className={cn(
//   //       "border border-dashed p-4 text-center cursor-pointer",
//   //       drag && "bg-gray-100"
//   //     )}
//   //     onDragOver={(e) => {
//   //       e.preventDefault();
//   //       setDrag(true);
//   //     }}
//   //     onDragLeave={() => setDrag(false)}
//   //     onDrop={(e) => {
//   //       e.preventDefault();
//   //       setDrag(false);
//   //       const file = e.dataTransfer.files?.[0];
//   //       handleFile(file);
//   //     }}
//   //     onClick={() => inputRef.current?.click()}
//   //   >
//   //     <input
//   //       ref={inputRef}
//   //       type="file"
//   //       accept="image/*"
//   //       className="hidden"
//   //       onChange={(e) => handleFile(e.target.files?.[0])}
//   //     />
//   //     <p>Drop image or click to upload</p>
//   //   </div>
//   // );
//   return (
//     <div className="flex flex-col items-center gap-2 border-2 border-dashed
//                     border-gray-300 rounded-lg p-4 text-center">
//       <input
//         type="file"
//         accept="image/*"
//         onChange={(e) => {
//           const f = e.target.files?.[0];
//           if (f) onFile(f);
//         }}
//         className="hidden"
//         id="thumb-input"
//       />
//       <label htmlFor="thumb-input" className="cursor-pointer select-none">
//         <span className="text-sm">Drop or click to upload</span>
//       </label>
//       {/*  you can keep additional hints/buttons INSIDE this wrapper div  */}
//     </div>
//   );
// }


"use client";
import React, { forwardRef, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  /** Called after the user selects / drops a file */
  onFile: (file: File) => void;
}

/**
 * Returns ONE <div> – Radix Slot friendly.
 * We also forward the ref so <FormControl> can attach it.
 */
const ImageDropzone = forwardRef<HTMLInputElement, Props>(
  ({ onFile }, ref) => {
    const [drag, setDrag] = useState(false);

    const handleFile = (f?: File) => f && onFile(f);

    return (
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg p-4 text-center",
          "border-2 border-dashed border-gray-300",
          drag && "bg-gray-100"
        )}
        onDragOver={e => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {/* _single_ input element – hidden but focusable via forwarded ref */}
        <input
          ref={ref}                      /* <- forwarded to FormControl     */
          id="thumb-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />

        <label htmlFor="thumb-input" className="cursor-pointer select-none">
          <span className="text-sm">Drop or click to upload</span>
        </label>

        <p className="text-xs text-gray-500">PNG / JPG • max 2 MB</p>
      </div>
    );
  }
);

ImageDropzone.displayName = "ImageDropzone";
export default ImageDropzone;
