import { PageContainer } from "@/components/marketing/page-container";

export default function ArticleLoading() {
  return (
    <div className="animate-pulse" aria-label="Memuat artikel">
      <section className="neo-grid-paper border-b-[3px] border-neo-ink py-16">
        <PageContainer className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="h-8 w-40 border-2 border-neo-ink bg-neo-yellow" />
            <div className="h-16 w-full max-w-xl border-[3px] border-neo-ink bg-white" />
            <div className="h-7 w-4/5 border-2 border-neo-ink bg-white" />
          </div>
          <div className="aspect-[16/10] border-[3px] border-neo-ink bg-neo-blue shadow-neo" />
        </PageContainer>
      </section>
      <PageContainer className="grid gap-6 py-12">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-44 border-[3px] border-neo-ink bg-white shadow-neo" />
        ))}
      </PageContainer>
    </div>
  );
}
