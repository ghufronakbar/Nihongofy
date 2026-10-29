"use client";

import { useState, type RefObject } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Coins,
  CookingPot,
  Flower2,
  Footprints,
  Gift,
  HousePlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  activeQuests,
  UPGRADES,
  UPGRADE_IDS,
  upgradeCost,
  type UpgradeId,
} from "./progression";
import type { GameState } from "./domain";

export const yen = (amount: number) => `¥${amount.toLocaleString("ja-JP")}`;

export function QuestJournal({
  game,
  claim,
}: {
  game: GameState;
  claim: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const quests = activeQuests(game);
  const completed = quests.filter(
    (quest) => quest.progress >= quest.target,
  ).length;
  return (
    <section
      className="kitchen-journal"
      aria-label="Quest kedai"
      data-open={open}
    >
      <button
        type="button"
        className="kitchen-journal-heading"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="kitchen-quest-list"
      >
        <BookOpen size={17} />
        <span>
          Catatan kedai
          <small>
            {completed
              ? `${completed} hadiah siap`
              : `Bab ${game.questCycle + 1} · ${quests.length} quest`}
          </small>
          {!open && quests[0] && (
            <small className="kitchen-mobile-quest">
              {completed
                ? `${completed} hadiah siap`
                : `${quests[0].title} · ${quests[0].progress}/${quests[0].target}`}
            </small>
          )}
        </span>
        <ChevronDown size={15} />
      </button>
      <ol id="kitchen-quest-list" className="kitchen-quests">
        {quests.map((quest, index) => (
          <li
            key={`${game.questCycle}-${quest.id}`}
            hidden={!open && index > 0}
          >
            <span className="kitchen-quest-name">
              {quest.progress >= quest.target && <Check size={13} />}
              {quest.title}
            </span>
            {open && <p>{quest.description}</p>}
            <div
              className="kitchen-quest-progress"
              role="progressbar"
              aria-label={quest.title}
              aria-valuenow={quest.progress}
              aria-valuemin={0}
              aria-valuemax={quest.target}
            >
              <span
                style={{
                  transform: `scaleX(${quest.progress / quest.target})`,
                }}
              />
            </div>
            <div className="kitchen-quest-reward">
              <small>
                {quest.id === "revenue" ? yen(quest.progress) : quest.progress}/
                {quest.id === "revenue" ? yen(quest.target) : quest.target}
              </small>
              {quest.progress >= quest.target ? (
                <Button
                  className="kitchen-claim"
                  onClick={() => claim(quest.id)}
                  aria-label={`Klaim ${quest.title}, hadiah ¥${quest.reward}`}
                >
                  <Gift size={13} /> Klaim {yen(quest.reward)}
                </Button>
              ) : (
                <span>
                  <Coins size={12} />
                  {yen(quest.reward)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const upgradeIcons = {
  stove: CookingPot,
  shoes: Footprints,
  decor: Flower2,
  waiter: Users,
  expansion: HousePlus,
};

export function ManagementPanel({
  game,
  container,
  close,
  upgrade,
}: {
  game: GameState;
  container: RefObject<HTMLDivElement | null>;
  close: () => void;
  upgrade: (id: UpgradeId) => void;
}) {
  return (
    <Dialog
      open={game.panel === "upgrades"}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        portalContainer={container}
        overlayClassName="kitchen-modal-backdrop"
        className="kitchen-management-dialog"
      >
        <DialogHeader>
          <span className="kitchen-panel-eyebrow">
            SATU LANGKAH LAGI UNTUK KEDAIMU
          </span>
          <DialogTitle>Kembangkan kedai.</DialogTitle>
          <DialogDescription>
            Belanjakan hasil pelayananmu. Pelanggan menunggu selama panel ini
            terbuka.
          </DialogDescription>
        </DialogHeader>
        <div className="kitchen-management-wallet">
          <Coins size={18} />
          <span>Uang kedai</span>
          <strong>{yen(game.score)}</strong>
        </div>
        <div className="kitchen-upgrades">
          {UPGRADE_IDS.map((id) => {
            const offer = UPGRADES[id];
            const level = game.upgrades[id];
            const cost = upgradeCost(game, id);
            const Icon = upgradeIcons[id];
            return (
              <article
                className="kitchen-upgrade"
                key={id}
                data-maxed={cost === null}
              >
                <span className="kitchen-upgrade-art">
                  <Icon size={25} />
                </span>
                <div>
                  <span className="kitchen-upgrade-level">
                    Level {level}/{offer.costs.length}
                  </span>
                  <h3>{offer.name}</h3>
                  <p>{offer.description}</p>
                  <strong>
                    {cost === null
                      ? "Semua peningkatan terpasang"
                      : offer.effect[level]}
                  </strong>
                  <Button
                    className="kitchen-buy"
                    onClick={() => upgrade(id)}
                    disabled={cost === null || game.score < cost}
                    aria-label={
                      cost === null
                        ? `${offer.name} sudah maksimal`
                        : `Beli ${offer.name} ¥${cost}`
                    }
                  >
                    {cost === null ? (
                      <>
                        <Check size={14} /> Lengkap
                      </>
                    ) : game.score < cost ? (
                      `Butuh ${yen(cost - game.score)} lagi`
                    ) : (
                      <>
                        Beli <span>{yen(cost)}</span>
                      </>
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="kitchen-team-note">
          <Users size={16} />
          {game.upgrades.waiter
            ? "Aya mengambil masakan dari meja pengambilan. Ren bergabung pada level tim 2."
            : "Rekrut Aya, lalu taruh menu yang sudah dimasak di meja pengambilan."}
        </p>
        <Button className="kitchen-primary" onClick={close}>
          Kembali ke kedai
        </Button>
      </DialogContent>
    </Dialog>
  );
}
