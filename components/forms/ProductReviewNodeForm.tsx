import { ProductReviewValidation } from "@/lib/validations/thread";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import { ChangeEvent, useState } from "react";
import { z } from "zod";
import { Button } from "../ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

interface Props {
  onSubmit: (values: z.infer<typeof ProductReviewValidation>) => void;
  currentProductName: string;
  currentRating: number;
  currentSummary: string;
  currentProductLink: string;
  currentClaims: string[];
  currentImages: string[];
}



const ProductReviewNodeForm = ({
  onSubmit,
  currentProductName,
  currentRating,
  currentSummary,
  currentProductLink,
  currentClaims,
  currentImages,
}: Props) => {
  const [imageURLs, setImageURLs] = useState<string[]>(currentImages);
  const form = useForm({
    resolver: zodResolver(ProductReviewValidation),
    defaultValues: {
      productName: currentProductName,
      rating: currentRating,
      summary: currentSummary,
      productLink: currentProductLink,
      claims: [
        currentClaims[0] || "",
        currentClaims[1] || "",
        currentClaims[2] || "",
      ],
      images: [] as File[],
    },
  });

  const handleImages = (
    e: ChangeEvent<HTMLInputElement>,
    fieldChange: (value: File[]) => void
  ) => {
    e.preventDefault();
    const files = Array.from(e.target.files || []);
    fieldChange(files);
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target?.result?.toString() || "");
            reader.readAsDataURL(file);
          })
      )
    ).then((urls) => setImageURLs((prev) => [...prev, ...urls]));
  };

  return (
    <Form {...form}>
      <form
        method="POST"
        className="ml-3 mr-3"
        onSubmit={form.handleSubmit((vals) => {
          const filtered = vals.claims.filter((c) => c.trim() !== "");
          onSubmit({ ...vals, claims: filtered });
        })}
      >
      <hr />
      <div className="py-2 grid gap-0 ">
        <label className="flex flex-col text-slate-900 gap-3 text-[14px] ">
          Product Name:
          <Input className="border-blue " type="text" {...form.register("productName")} defaultValue={currentProductName} />
        </label>
        <label className="flex flex-col text-slate-900 gap-3 text-[14px] ">
          Rating:
          <Input className="border-blue " type="number" min={1} max={5} {...form.register("rating", { valueAsNumber: true })} defaultValue={currentRating} />
        </label>
        <label className="flex flex-col text-slate-900 gap-3 text-[14px] ">
          Summary:
          <Input className="border-blue " type="text" {...form.register("summary")} defaultValue={currentSummary} />
        </label>
        <label className="flex flex-col text-slate-900 gap-3 text-[14px] ">
          Product Link:
          <Input className="border-blue " type="url" {...form.register("productLink")} defaultValue={currentProductLink} />
        </label>
        <label className="flex flex-col text-slate-900 gap-3 text-[14px] ">
          Claims:
          <Controller
            control={form.control}
            name="claims"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((idx) => (
                  <Input
                  className="border-blue "
                    key={idx}
                    type="text"
                    value={field.value[idx] || ""}
                    onChange={(e) => {
                      const copy = [...field.value];
                      copy[idx] = e.target.value;
                      field.onChange(copy);
                    }}
                  />
                ))}
              </div>
            )}
          />
        </label>
        <FormField
          control={form.control}
          name="images"
          render={({ field }) => (
            <FormItem className="flex gap-4 mb-2 text-sm">
              <FormControl className="flex">
                <Input
                  hidden
                  multiple
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImages(e, field.onChange)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <hr />
      <div className="py-2  mb-0">
        <Button type="submit" className=" border-blue border-[1px] rounded-xl" size={"lg"}>
          Save Changes
        </Button>
      </div>
      </form>
    </Form>
  );
};

export default ProductReviewNodeForm;
