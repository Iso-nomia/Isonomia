// app/admin/schemes/page.tsx
import React from "react";
import SchemeList from "@/components/admin/SchemeList";

export const dynamic = "force-dynamic";

export default async function AdminSchemesPage() {
  return (
    <div className="container mx-auto py-8 px-8">
      <SchemeList />
    </div>
  );
}
