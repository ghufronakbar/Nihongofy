export type MenuId = "onigiri" | "tamago" | "ocha";
export const UPGRADE_IDS = [
  "stove",
  "shoes",
  "decor",
  "waiter",
  "expansion",
] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type Upgrades = Record<UpgradeId, number>;

export const UPGRADES = {
  stove: {
    name: "Dapur gesit",
    description: "Waktu memasak lebih singkat di semua dapur.",
    costs: [220, 480, 850],
    effect: [
      "Masak 25% lebih cepat",
      "Masak 40% lebih cepat",
      "Masak 55% lebih cepat",
    ],
  },
  shoes: {
    name: "Langkah ringan",
    description: "Chef bergerak lebih cepat membawa pesanan.",
    costs: [180, 400],
    effect: ["Gerak chef +20%", "Gerak chef +40%"],
  },
  decor: {
    name: "Suasana hangat",
    description: "Lampu dan dekorasi membuat pelanggan lebih sabar.",
    costs: [200, 450],
    effect: ["Kesabaran +15 detik", "Kesabaran +30 detik, tip +¥10"],
  },
  waiter: {
    name: "Tim pelayan",
    description: "Taruh masakan di meja pengambilan. Pelayan mengantarnya.",
    costs: [350, 650],
    effect: ["Rekrut Aya", "Rekrut Ren, pelayan kedua"],
  },
  expansion: {
    name: "Perluas teras",
    description: "Buka area teras dan tambah meja untuk pelanggan baru.",
    costs: [500, 800],
    effect: ["Buka teras + meja keempat", "Tambah meja kelima"],
  },
} as const;

export type QuestMetrics = {
  served: number;
  revenue: number;
  quickServed: number;
  vipServed: number;
  waiterServed: number;
  dishTotals: Record<MenuId, number>;
};
export type Progression = QuestMetrics & {
  score: number;
  missed: number;
  bestCombo: number;
  learned: MenuId[];
  upgrades: Upgrades;
  questCycle: number;
  questClaimed: string[];
  questBaseline: QuestMetrics;
};
export type Quest = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
};

export function metrics(): QuestMetrics {
  return {
    served: 0,
    revenue: 0,
    quickServed: 0,
    vipServed: 0,
    waiterServed: 0,
    dishTotals: { onigiri: 0, tamago: 0, ocha: 0 },
  };
}

export function createProgression(): Progression {
  return {
    ...metrics(),
    score: 0,
    missed: 0,
    bestCombo: 0,
    learned: [],
    upgrades: { stove: 0, shoes: 0, decor: 0, waiter: 0, expansion: 0 },
    questCycle: 0,
    questClaimed: [],
    questBaseline: metrics(),
  };
}

function quests(progress: Progression): Quest[] {
  const p = progress;
  if (p.questCycle > 0) {
    const round = p.questCycle;
    const food = (["onigiri", "tamago", "ocha"] as const)[(round - 1) % 3];
    const names = { onigiri: "Onigiri", tamago: "Tamago", ocha: "Ocha" };
    return [
      {
        id: "regulars",
        title: `Cerita kedai #${round}`,
        description: `Layani ${4 + round} pelanggan lagi.`,
        progress: p.served - p.questBaseline.served,
        target: 4 + round,
        reward: 180 + round * 20,
      },
      {
        id: "special",
        title: `${names[food]} pilihan hari ini`,
        description: `Antar ${4 + round} ${names[food]}. Pesanan pelayan ikut dihitung.`,
        progress: p.dishTotals[food] - p.questBaseline.dishTotals[food],
        target: 4 + round,
        reward: 160 + round * 20,
      },
      round % 2 === 0
        ? {
            id: "team",
            title: "Tim yang kompak",
            description: "Biarkan pelayan menyelesaikan 4 pelanggan lagi.",
            progress: p.waiterServed - p.questBaseline.waiterServed,
            target: 4,
            reward: 220,
          }
        : {
            id: "vip",
            title: "Tamu terhormat",
            description: "Selesaikan pesanan 2 pelanggan VIP lagi.",
            progress: p.vipServed - p.questBaseline.vipServed,
            target: 2,
            reward: 220,
          },
    ];
  }
  return [
    {
      id: "welcome",
      title: "Sajian pertama",
      description: "Masak onigiri dan layani pelanggan pertamamu.",
      progress: p.served,
      target: 1,
      reward: 100,
    },
    {
      id: "tasting",
      title: "Trio rasa",
      description: "Antar onigiri, tamago, dan ocha, masing-masing sekali.",
      progress: Object.values(p.dishTotals).filter((value) => value > 0).length,
      target: 3,
      reward: 160,
    },
    {
      id: "combo",
      title: "Senyum beruntun",
      description: "Capai combo 3 tanpa pelanggan terlewat.",
      progress: p.bestCombo,
      target: 3,
      reward: 140,
    },
    {
      id: "stove",
      title: "Dapur naik kelas",
      description: "Beli upgrade Dapur gesit di meja pengelola.",
      progress: p.upgrades.stove,
      target: 1,
      reward: 140,
    },
    {
      id: "onigiri",
      title: "Nasi kepal favorit",
      description: "Antar 4 onigiri ke pelanggan.",
      progress: p.dishTotals.onigiri,
      target: 4,
      reward: 160,
    },
    {
      id: "hire",
      title: "Selamat datang, Aya",
      description: "Rekrut pelayan pertamamu di Kelola kedai.",
      progress: p.upgrades.waiter,
      target: 1,
      reward: 180,
    },
    {
      id: "quick",
      title: "Masih hangat",
      description: "Selesaikan 3 pelanggan dalam 15 detik sejak duduk.",
      progress: p.quickServed,
      target: 3,
      reward: 160,
    },
    {
      id: "team",
      title: "Titip ke Aya",
      description:
        "Taruh masakan di meja pengambilan; pelayan menyelesaikan 3 pelanggan.",
      progress: p.waiterServed,
      target: 3,
      reward: 200,
    },
    {
      id: "terrace",
      title: "Angin di teras",
      description: "Beli perluasan teras dan buka meja keempat.",
      progress: p.upgrades.expansion,
      target: 1,
      reward: 200,
    },
    {
      id: "vip",
      title: "Tamu terhormat",
      description: "Selesaikan semua menu untuk 2 pelanggan VIP.",
      progress: p.vipServed,
      target: 2,
      reward: 200,
    },
    {
      id: "decor",
      title: "Serasa di rumah",
      description: "Pasang dekorasi Suasana hangat.",
      progress: p.upgrades.decor,
      target: 1,
      reward: 120,
    },
    {
      id: "tamago",
      title: "Jago telur",
      description: "Antar 5 tamago ke pelanggan.",
      progress: p.dishTotals.tamago,
      target: 5,
      reward: 180,
    },
    {
      id: "regulars",
      title: "Kedai langganan",
      description: "Layani 15 pelanggan sampai pesanan mereka lengkap.",
      progress: p.served,
      target: 15,
      reward: 240,
    },
    {
      id: "tables",
      title: "Ruang untuk semua",
      description: "Perluas teras sampai meja kelima tersedia.",
      progress: p.upgrades.expansion,
      target: 2,
      reward: 250,
    },
    {
      id: "revenue",
      title: "Cerita tiga ribu yen",
      description:
        "Kumpulkan total penjualan ¥3.000. Belanja tidak mengurangi progres.",
      progress: p.revenue,
      target: 3000,
      reward: 300,
    },
  ];
}

export function activeQuests(progress: Progression): Quest[] {
  return quests(progress)
    .filter((quest) => !progress.questClaimed.includes(quest.id))
    .slice(0, 3)
    .map((quest) => ({
      ...quest,
      progress: Math.min(quest.target, Math.max(0, quest.progress)),
    }));
}

export function claimQuest(progress: Progression, id: string): Quest | null {
  const quest = activeQuests(progress).find((entry) => entry.id === id);
  if (!quest || quest.progress < quest.target) return null;
  progress.questClaimed.push(id);
  progress.score += quest.reward;
  if (progress.questClaimed.length === quests(progress).length) {
    progress.questCycle++;
    progress.questClaimed = [];
    progress.questBaseline = {
      served: progress.served,
      revenue: progress.revenue,
      quickServed: progress.quickServed,
      vipServed: progress.vipServed,
      waiterServed: progress.waiterServed,
      dishTotals: { ...progress.dishTotals },
    };
  }
  return quest;
}

export function upgradeCost(
  progress: Progression,
  id: UpgradeId,
): number | null {
  return UPGRADES[id].costs[progress.upgrades[id]] ?? null;
}

export function purchaseUpgrade(progress: Progression, id: UpgradeId): boolean {
  const cost = upgradeCost(progress, id);
  if (cost === null || progress.score < cost) return false;
  progress.score -= cost;
  progress.upgrades[id]++;
  return true;
}
