// components/dashboard/ItemsPanel.tsx
"use client";
import useSWR from "swr";
import { AddItemModal } from "./AddItemModal";
import Image from "next/image";
export function ItemsPanel({ stallId }: { stallId: string }) {
  const { data, mutate } = useSWR(
    `/api/stalls/${stallId}/items`,
    (url: string) => fetch(url).then((r) => r.json())
  );

  return (
    <>
      <div className="flex  justify-between items-center mb-4 ">
        <h2 className="text-[1.37rem] font-semibold">Your Items</h2>
        <AddItemModal stallId={stallId} />
      </div>

      {!data ? (
        <p>Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-gray-500">No items yet.</p>
      ) : (
        <ul className="flex w-full flex-wrap max-w-[70%] gap-4 ">
          {data.map((item: any) => (
            <li
              key={item.id}
              className="rounded-xl justify-center items-center border-2 p-4 space-y-2 bg-white/40 shadow-lg"
            >
              {/* <img src={item.images[0]} width={50} height={50}  className="h-fit w-fit object-cover rounded" /> */}
              <h3 className="text-center text-[1.2rem] font-medium">
                {item.name}
              </h3>
              <hr></hr>
              <p className="text-center text-[1.1rem]">
                ${(item.price_cents / 100).toFixed(2)} &middot; {item.stock}{" "}
                Left&nbsp;
              </p>{" "}
              {item.sold && <span className="text-green-600">Sold</span>}
              <Image
                src={item.images[0]}
                alt="stallimg"
                width={200}
                height={200}
                className="justify-center items-center object-contain rounded"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
