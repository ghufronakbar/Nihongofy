"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MessageSquareText, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteConversationSessionAction } from "../actions";
import { findPersona } from "../data/personas";
import type { ConversationSessionSummary } from "../queries";
import { PersonaAvatar } from "./persona-avatar";

export function ConversationSessionList({
  sessions,
  basePath,
}: {
  sessions: ConversationSessionSummary[];
  basePath: "/conversation" | "/speaking";
}) {
  const [removed, setRemoved] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  const visible = sessions.filter((session) => !removed.includes(session.id));

  if (visible.length === 0) {
    return (
      <div className="neo-surface p-8 text-center">
        <MessageSquareText className="mx-auto size-10 opacity-40" aria-hidden="true" />
        <p className="mt-4 font-bold">Belum ada percakapan tersimpan.</p>
        <Link href={`${basePath}/setup`} className="neo-button mt-5">
          Mulai percakapan
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {visible.map((session) => {
        const persona = findPersona(session.personaKey);
        // turnCount menghitung baris turn; satu pertukaran berisi dua baris.
        const exchanges = Math.floor(session.turnCount / 2);

        return (
          <li key={session.id} className="neo-surface flex items-center gap-4 p-4">
            {persona && <PersonaAvatar persona={persona} size="sm" />}
            <div className="min-w-0 flex-1">
              <p className="font-black">{persona?.name ?? "Partner tidak dikenal"}</p>
              <p className="text-xs font-bold text-foreground/60">
                {session.jlptLevel} · {exchanges} giliran
                {session.transcriptRetained ? "" : " · isi tidak disimpan"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`${basePath}/${session.id}`}
                className="min-h-11 rounded-lg border-[3px] border-neo-ink bg-white px-3 py-2 text-sm font-bold shadow-neo-sm"
              >
                Buka
              </Link>
              <AlertDialog>
                <AlertDialogTrigger
                  aria-label={`Hapus percakapan dengan ${persona?.name ?? "partner"}`}
                  className="grid size-11 place-items-center rounded-lg border-[3px] border-neo-ink bg-white shadow-neo-sm"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus percakapan ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Percakapan dengan {persona?.name ?? "partner"} beserta {exchanges} giliranmu
                      akan dihapus. Tindakan ini tidak bisa dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteConversationSessionAction({
                            sessionId: session.id,
                          });
                          if (result.ok) setRemoved((prev) => [...prev, session.id]);
                        })
                      }
                    >
                      Hapus
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
