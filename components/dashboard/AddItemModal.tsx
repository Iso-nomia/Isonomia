// "use client";
// import { useForm } from "react-hook-form";
// import { z } from "zod";
// import { zodResolver } from "@hookform/resolvers/zod";
// import Dropzone from "react-dropzone";
// import { uploadItemImage } from "@/lib/uploadItemImage";
// import { createItem } from "@/lib/items.client";

// const Schema = z.object({
//   name: z.string().min(3),
//   description: z.string().min(3),
//   price: z.number({ invalid_type_error: "Price required" }).min(0.5, "Min $0.50"),
//   stock: z.number().int().min(1),
//   images: z.array(z.string()).min(1, "At least one photo"),
// });

// type FormData = z.infer<typeof Schema>;

// export function AddItemModal({ stallId }: { stallId: string }) {
//   const {
//     register,
//     handleSubmit,
//     watch,
//     setValue,
//     formState: { errors },
//   } = useForm<FormData>({ resolver: zodResolver(Schema), defaultValues: { images: [] } });

//   const onDrop = async (files: File[]) => {
//     for (const file of files) {
//       const url = await uploadItemImage(stallId, file);
//       setValue("images", [...watch("images"), url]);
//     }
//   };

//   const onSubmit = async (data: FormData) => {
//     await createItem(stallId, data);
//   };

//   return (
//     <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
//       <input {...register("name")} placeholder="Title" />
//       <textarea {...register("description")} placeholder="Details (Markdown ok)" />
//       <input {...register("price", { valueAsNumber: true })} type="number" step="0.01" />
//       <input {...register("stock", { valueAsNumber: true })} type="number" />
//       <Dropzone onDrop={onDrop}><p>Drag photos here</p></Dropzone>
//       <div className="border p-2">
//         <h4>{watch("name")}</h4>
//         <p>{watch("description")}</p>
//         <p>${watch("price")?.toFixed(2)}</p>
//         <div className="flex gap-2">
//           {watch("images").map(src => (
//             <img key={src} src={src} className="h-16 w-16 object-cover" />
//           ))}
//         </div>
//       </div>
//       <button type="submit">Save</button>
//       {Object.values(errors).map(e => (
//         <p key={e?.message} className="text-red-500">{e?.message}</p>
//       ))}
//     </form>
//   );
// }

// components/dashboard/AddItemModal.tsx
"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Dropzone from "react-dropzone";
import { uploadItemImage } from "@/lib/uploadItemImage";
import { createItem } from "@/lib/items.client";

const Schema = z.object({
  name: z.string().min(3),
  description: z.string().min(3),
  price: z.number().min(0.5, "Min $0.50"),
  stock: z.number().int().min(1),
  images: z.array(z.string()).min(1, "At least one photo"),
});
type FormData = z.infer<typeof Schema>;

export function AddItemModal({ stallId }: { stallId: string }) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(Schema),
    defaultValues: { images: [] },
  });

  const onDrop = async (files: File[]) => {
    for (const f of files) {
      const url = await uploadItemImage(stallId, f);
      setValue("images", [...watch("images"), url]);
    }
  };

  const onSubmit = async (data: FormData) => {
    await createItem(stallId, data);
    setOpen(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-xl likebutton p-4 border-[1px] border-blue bg-white bg-opacity-20 mr-[5%]">
        + Add Item
      </button>

      {open && (
        <dialog
          open
          className="fixed inset-0 m-auto max-w-lg rounded bg-white p-6 shadow"
        >
          <h3 className="text-xl font-semibold mb-4">New Item</h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input
              {...register("name")}
              placeholder="Title"
              className="input w-full"
            />
            <textarea
              {...register("description")}
              placeholder="Description (Markdown ok)"
              className="textarea w-full"
            />

            <div className="flex gap-4">
              <input
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
                placeholder="Price"
                className="input flex-1"
              />
              <input
                type="number"
                {...register("stock", { valueAsNumber: true })}
                placeholder="Stock"
                className="input flex-1"
              />
            </div>

            {/* <Dropzone onDrop={onDrop} accept={{ 'image/*': [] }}>
              {({ getRootProps, getInputProps }) => (
                <section {...getRootProps({ className: 'border-dashed border-2 p-4 cursor-pointer' })}>
                  <input {...getInputProps()} />
                  <p>Drag & drop photos here, or click to select</p>
                </section>
              )}
            </Dropzone> */}
            <Dropzone
              onDrop={onDrop}
              maxFiles={5}
              accept={{ "image/*": [] }}
            >
              {({ getRootProps, getInputProps, isDragActive }) => (
                <div
                  {...getRootProps({
                    className: `flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6
                    ${
                      isDragActive
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300"
                    }`,
                  })}
                >
                  <input {...getInputProps()} />
                  <p className="text-sm text-gray-600">
                    {isDragActive
                      ? "Drop the files here…"
                      : "Dragʼnʼdrop or click to select images"}
                  </p>
                </div>
              )}
            </Dropzone>

            <div className="flex gap-2">
              {watch("images").map((src) => (
                <img
                  key={src}
                  src={src}
                  className="h-16 w-16 object-cover rounded"
                />
              ))}
            </div>

            {Object.values(errors).map((e) => (
              <p key={e?.message} className="text-red-500">
                {e?.message}
              </p>
            ))}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
