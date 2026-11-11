import { articleJapaneseFont } from "@/features/article/fonts";
import "@/features/article/article.css";
export default function AdminArticleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={articleJapaneseFont.variable}>{children}</div>;
}
