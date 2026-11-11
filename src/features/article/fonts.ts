import localFont from "next/font/local";
export const articleJapaneseFont = localFont({
  src: "../../../assets/fonts/NotoSansJP-Regular.ttf",
  variable: "--font-article-japanese",
  display: "swap",
  preload: false,
});
