import { dictionaryQuerySchema } from "./schemas";

const EXCLUDED = 'input,textarea,select,button,a,[role="button"],[role="textbox"],[contenteditable]:not([contenteditable="false"]),[data-dictionary-ignore]';
const BLOCK = 'p,li,td,th,h1,h2,h3,h4,h5,h6,blockquote,[data-dictionary-block]';

function elementFor(node: Node | null) {
  return node instanceof Element ? node : node?.parentElement ?? null;
}

function blockFor(node: Node, region: HTMLElement) {
  const element = elementFor(node);
  const semantic = element?.closest(BLOCK);
  if (semantic && region.contains(semantic)) return semantic;
  let current = element;
  while (current && current !== region) {
    const display = getComputedStyle(current).display;
    if (!["inline", "inline-block", "contents", "ruby", "ruby-base", "ruby-text"].includes(display)) return current;
    current = current.parentElement;
  }
  return region;
}

/** Original DOM traversal also excludes a partial selection starting inside rt.
 * cloneContents().textContent would include furigana in that case. */
export function selectedBaseText(range: Range): string | null {
  const root = range.commonAncestorContainer;
  const nodes: Node[] = [];
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root);
  else {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node);
  }
  let text = "";
  for (const node of nodes) {
    if (!range.intersectsNode(node)) continue;
    const parent = elementFor(node);
    if (parent?.closest("rt,rp")) continue;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : (node.textContent?.length ?? 0);
    const selected = node.textContent?.slice(start, end) ?? "";
    if (!selected) continue;
    if (parent?.closest(EXCLUDED)) return null;
    text += selected;
  }
  return text.trim();
}

export type DictionarySelection = {
  text: string;
  query: string;
  range: Range;
  rect: DOMRect;
  region: HTMLElement;
  block: Element;
};

export function readDictionarySelection(selection: Selection | null): DictionarySelection | "too-long" | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const start = elementFor(range.startContainer);
  const end = elementFor(range.endContainer);
  if (!start || !end || start.closest(EXCLUDED) || end.closest(EXCLUDED)) return null;
  const region = start.closest<HTMLElement>("[data-dictionary-region]");
  if (!region || end.closest("[data-dictionary-region]") !== region || region.dataset.dictionaryEnabled !== "true") return null;
  const block = blockFor(range.startContainer, region);
  if (blockFor(range.endContainer, region) !== block) return null;
  const text = selectedBaseText(range);
  if (!text) return null;
  if ([...text].length > 40) return "too-long";
  const parsed = dictionaryQuerySchema.safeParse(text);
  if (!parsed.success) return null;
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
  // In a backwards keyboard selection the first line is closest to the focus.
  const backwards = selection.focusNode === range.startContainer && selection.focusOffset === range.startOffset;
  const rect = backwards ? rects[0] : rects.at(-1);
  if (!rect) return null;
  return { text, query: parsed.data, range: range.cloneRange(), rect, region, block };
}

export function sameDictionarySelection(left: DictionarySelection | null, right: DictionarySelection | null) {
  return !!left && !!right && left.region === right.region && left.text === right.text &&
    left.range.startContainer === right.range.startContainer && left.range.endContainer === right.range.endContainer &&
    left.range.startOffset === right.range.startOffset && left.range.endOffset === right.range.endOffset;
}

export function isDictionaryInteractionActive() {
  return typeof document !== "undefined" && document.querySelector('[data-dictionary-active="true"]') !== null;
}
