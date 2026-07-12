export type ArticleTemplate = {
  id: "standard" | "feature" | "interview";
  label: string;
  className: string;
};

export const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  { id: "standard", label: "Standard", className: "standard" },
  { id: "feature", label: "Feature", className: "feature" },
  { id: "interview", label: "Interview", className: "interview" },
];
