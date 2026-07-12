// app/(editor)/article/[id]/edit/page.tsx
import ArticleEditor from "@/components/article/ArticleEditor";
export default function EditArticle({ params }: { params: { id: string } }) {
  return <ArticleEditor articleId={params.id} />;
}
