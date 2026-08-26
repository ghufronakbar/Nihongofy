import type { ArticleBodyBlock } from "../schemas";

const CALLOUT_COLORS = {
  blue: "bg-neo-blue",
  yellow: "bg-neo-yellow",
  green: "bg-neo-green",
  coral: "bg-neo-coral",
} as const;

export function ArticleBody({ blocks }: { blocks: ArticleBodyBlock[] }) {
  return (
    <div className="article-body">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={key}>{block.text}</h2>
            ) : (
              <h3 key={key}>{block.text}</h3>
            );
          case "paragraph":
            return <p key={key}>{block.text}</p>;
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <List key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </List>
            );
          }
          case "quote":
            return (
              <blockquote key={key}>
                <p>{block.text}</p>
                {block.attribution ? <cite>- {block.attribution}</cite> : null}
              </blockquote>
            );
          case "example":
            return (
              <figure key={key} className="article-example">
                <p lang="ja" className="font-japanese article-example-japanese">
                  {block.japanese}
                </p>
                {block.reading ? (
                  <p lang="ja" className="font-japanese article-example-reading">
                    {block.reading}
                  </p>
                ) : null}
                <figcaption>
                  <strong>{block.translation}</strong>
                  {block.note ? <span>{block.note}</span> : null}
                </figcaption>
              </figure>
            );
          case "callout":
            return (
              <aside key={key} className={`article-callout ${CALLOUT_COLORS[block.tone]}`}>
                <strong>{block.title}</strong>
                <p>{block.text}</p>
              </aside>
            );
        }
      })}
    </div>
  );
}
