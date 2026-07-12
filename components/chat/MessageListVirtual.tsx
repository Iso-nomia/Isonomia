"use client";
import * as React from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

export type MessageListVirtualProps<T = any> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onReachTop?: () => void;
  onBottomStateChange?: (atBottom: boolean) => void;
  follow?: boolean;
  ariaLabel?: string;
};

export const MessageListVirtual = React.forwardRef<
  VirtuosoHandle,
  MessageListVirtualProps<any>
>(function MessageListVirtual<T = any>(
  {
    items,
    renderItem,
    onReachTop,
    onBottomStateChange,
    follow = true,
    ariaLabel = "Room messages",
  }: MessageListVirtualProps<T>,
  forwardedRef: React.ForwardedRef<VirtuosoHandle>
) {
  const virtuosoRef = React.useRef<VirtuosoHandle | null>(null);
  const stuckOnce = React.useRef(false);

  const setRefs = React.useCallback(
    (node: VirtuosoHandle | null) => {
      virtuosoRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as any).current = node;
    },
    [forwardedRef]
  );

  React.useEffect(() => {
    if (!follow || stuckOnce.current || !items.length) return;
    virtuosoRef.current?.scrollToIndex({ index: items.length - 1, align: "end" });
    stuckOnce.current = true;
  }, [items.length, follow]);

  const List = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...rest }, listRef) => (
      <div {...rest} role="list" ref={listRef} className="flex flex-col gap-2">
        {children}
      </div>
    )
  );
  List.displayName = "MessageListVirtualList";

  return (
    <div role="region" aria-label={ariaLabel} className="h-full w-full">
      <Virtuoso
        ref={setRefs}
        data={items}
        className="h-full"
        computeItemKey={(_, item: any) => String(item?.id ?? _)}
        followOutput={follow ? "smooth" : false}
        atTopThreshold={120}
        startReached={() => onReachTop?.()}
        atBottomStateChange={onBottomStateChange}
        increaseViewportBy={{ top: 400, bottom: 600 }}
        components={{
          List,
        }}
        itemContent={(_, item) => (
          <div role="listitem" tabIndex={-1}>
            {renderItem(item as T)}
          </div>
        )}
      />
    </div>
  );
}) as <T>(
  props: MessageListVirtualProps<T> & { ref?: React.ForwardedRef<VirtuosoHandle> }
) => React.ReactElement | null;
