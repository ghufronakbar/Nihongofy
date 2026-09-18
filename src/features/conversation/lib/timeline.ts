// Item yang ditampilkan runner. Giliran nyata berasal dari server; item
// kegagalan murni state client dan tidak pernah ditulis ke database.

export type TimelineTurn = {
  kind: "turn";
  id: string;
  /** ID baris di database. Null bila transcript tidak disimpan. */
  turnId?: number | null;
  role: "USER" | "ASSISTANT";
  contentJa: string;
  contentTranslation: string | null;
  contentRomaji: string | null;
};

export type TimelineError = {
  kind: "error";
  id: string;
  reason: string;
  message: string;
};

export type TimelineItem = TimelineTurn | TimelineError;

export function createItemId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function onlyTurns(items: readonly TimelineItem[]): TimelineTurn[] {
  return items.filter((item): item is TimelineTurn => item.kind === "turn");
}

export function countUserTurns(items: readonly TimelineItem[]): number {
  return onlyTurns(items).filter((turn) => turn.role === "USER").length;
}
