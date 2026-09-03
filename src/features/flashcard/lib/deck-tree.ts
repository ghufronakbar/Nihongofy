/**
 * Nama deck bersifat hierarkis dengan pemisah "::", persis Anki:
 * "Core" adalah induk dari "Core::N3" yang adalah induk dari "Core::N3::Verbs".
 * Tidak ada kolom parentId — hierarki sepenuhnya diturunkan dari nama, sehingga
 * rename satu deck otomatis memindahkan seluruh subtree-nya.
 */

export const DECK_SEPARATOR = "::";

export type DeckLike = {
  id: number;
  name: string;
};

export type DeckTreeNode<T extends DeckLike> = {
  deck: T;
  /** Segmen terakhir nama, mis. "Verbs" untuk "Core::N3::Verbs". */
  label: string;
  depth: number;
  children: DeckTreeNode<T>[];
};

export function splitDeckName(name: string): string[] {
  return name.split(DECK_SEPARATOR);
}

export function deckLabel(name: string): string {
  const parts = splitDeckName(name);
  return parts[parts.length - 1] ?? name;
}

export function deckParentName(name: string): string | null {
  const parts = splitDeckName(name);
  return parts.length <= 1 ? null : parts.slice(0, -1).join(DECK_SEPARATOR);
}

/** Semua nama induk dari yang terluar ke terdalam. */
export function deckAncestorNames(name: string): string[] {
  const parts = splitDeckName(name);
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join(DECK_SEPARATOR));
}

/**
 * `child` berada di dalam subtree `ancestor`. Perbandingan memakai pemisah
 * penuh supaya "Core2" tidak dianggap anak dari "Core".
 */
export function isDeckDescendantOf(child: string, ancestor: string): boolean {
  return child.startsWith(`${ancestor}${DECK_SEPARATOR}`);
}

export function isDeckInSubtree(name: string, root: string): boolean {
  return name === root || isDeckDescendantOf(name, root);
}

export function collectSubtreeDeckIds<T extends DeckLike>(decks: T[], rootName: string): number[] {
  return decks.filter((deck) => isDeckInSubtree(deck.name, rootName)).map((deck) => deck.id);
}

function compareDeckNames(left: string, right: string) {
  return left.localeCompare(right, "en", { numeric: true, sensitivity: "base" });
}

/**
 * Membangun pohon dari daftar datar. Deck yang induknya tidak ada (mis. hanya
 * "A::B" tanpa "A") diperlakukan sebagai root supaya tidak pernah hilang dari UI.
 */
export function buildDeckTree<T extends DeckLike>(decks: T[]): DeckTreeNode<T>[] {
  const sorted = [...decks].sort((left, right) => compareDeckNames(left.name, right.name));
  const nodesByName = new Map<string, DeckTreeNode<T>>();
  const roots: DeckTreeNode<T>[] = [];

  for (const deck of sorted) {
    const node: DeckTreeNode<T> = {
      deck,
      label: deckLabel(deck.name),
      depth: splitDeckName(deck.name).length - 1,
      children: [],
    };
    nodesByName.set(deck.name, node);

    const parentName = deckParentName(deck.name);
    const parent = parentName ? nodesByName.get(parentName) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      node.depth = 0;
      roots.push(node);
    }
  }

  return roots;
}

/** Node beserta seluruh keturunannya, terurut sesuai tampilan. */
export function flattenDeckTree<T extends DeckLike>(
  nodes: DeckTreeNode<T>[],
): DeckTreeNode<T>[] {
  return nodes.flatMap((node) => [node, ...flattenDeckTree(node.children)]);
}

/** Menjumlahkan nilai node beserta seluruh keturunannya. */
export function rollUpDeckTree<T extends DeckLike>(
  node: DeckTreeNode<T>,
  valueOf: (deck: T) => number,
): number {
  return (
    valueOf(node.deck) +
    node.children.reduce((total, child) => total + rollUpDeckTree(child, valueOf), 0)
  );
}
