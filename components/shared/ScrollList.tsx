"use client";

import { useEffect, useRef } from "react";
import Scrollbar from "smooth-scrollbar";
import OverscrollPlugin from "smooth-scrollbar/plugins/overscroll";
import clsx from "clsx";

interface ScrollListProps {
  children: React.ReactNode[];
  
}

export default function ScrollList({ children }: ScrollListProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wrapperRef.current) return;
    Scrollbar.use(OverscrollPlugin);
    const scrollbar = Scrollbar.init(wrapperRef.current, {
      plugins: { overscroll: true },
    });

    const handle = () => {
      const top = scrollbar.offset.y;
      const items = wrapperRef.current!.querySelectorAll<HTMLDivElement>(
        ".js-scroll-list-item"
      );
      // let focused = false;
      let firstFocusIndex: number | null = null;
      items.forEach((el, idx) => {
        // el.classList.remove("item-focus", "item-next", "item-hide");
        el.classList.remove(
                    "item-focus",
                    "item-second-focus",
                    "item-next",
                    "item-hide"
                  );
        const relTop = el.offsetTop;
        // if (!focused && relTop >= top) {
        //   el.classList.add("item-focus");
        //   const next = items[idx + 1];
        //   if (next) next.classList.add("item-next");
        //   focused = true;
        // } else if (!focused) {
        //   el.classList.add("item-hide");
        // }
        if (firstFocusIndex === null && relTop >= top) {
                    firstFocusIndex = idx;
                  }
      });
      if (firstFocusIndex !== null) {
                // First card in focus
                items[firstFocusIndex].classList.add("item-focus");
        
                // Second card in focus (if it exists)
                const second = items[firstFocusIndex + 1];
                if (second) second.classList.add("item-second-focus");
        
                // Optional: tag the *third* card so you can style it (dim/scale) if desired
                const third = items[firstFocusIndex + 2];
                if (third) third.classList.add("item-next");

                 // Optional: tag the *third* card so you can style it (dim/scale) if desired
                 const fourplus = items[firstFocusIndex + 3];
                 if (fourplus) fourplus.classList.add("item-next");
         
        
                // Hide everything *before* the first focused card
                for (let i = 0; i < firstFocusIndex; i++) {
                  items[i].classList.add("item-hide");
                }
              }
    };

    scrollbar.addListener(handle);
    handle();
    return () => {
      scrollbar.removeListener(handle);
      scrollbar.destroy();
    };
  }, []);

  return (
    <div ref={wrapperRef} className="scroll-list__wrp js-scroll-list h-[95vh] space-y-0 w-full ">
      <div className="js-scroll-content  space-y-4 w-full">{children}</div>
    </div>
  );
}
