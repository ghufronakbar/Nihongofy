// Mengubah role satu user antara USER dan ADMIN.
//
// Admin pertama HARUS dibuat lewat script ini, bukan lewat UI: promote dari UI
// membutuhkan admin yang sudah ada, dan bootstrap "user pertama jadi admin"
// sengaja tidak dipakai di project ini (model one-time setup sudah dihentikan
// sejak Fase 1 auth).
//
// Script ini tidak menyentuh session. Demote berlaku seketika karena role dibaca
// dari database per request, bukan dari payload JWT.
//
// Contoh:
//   node --env-file-if-exists=.env prisma/set-user-role.mjs --email a@b.com --role ADMIN
//   npm run user:role -- --email a@b.com --role USER
//   npm run user:role -- --list
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VALID_ROLES = ["USER", "ADMIN"];

function log(message) {
  console.log(`[user:role] ${message}`);
}

function parseArguments(argv) {
  const options = { email: null, id: null, role: null, list: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--list") {
      options.list = true;
      continue;
    }
    if (argument.startsWith("--email")) {
      options.email = readValue("--email");
      continue;
    }
    if (argument.startsWith("--id")) {
      options.id = readValue("--id");
      continue;
    }
    if (argument.startsWith("--role")) {
      options.role = readValue("--role");
      continue;
    }
  }

  return options;
}

async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, email: true, displayName: true },
    orderBy: { id: "asc" },
  });

  if (admins.length === 0) {
    log("Belum ada admin sama sekali.");
    return;
  }

  log(`${admins.length} admin:`);
  for (const admin of admins) {
    console.log(`  #${admin.id}  ${admin.email ?? "(tanpa email)"}  ${admin.displayName}`);
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));

  if (options.list) {
    await listAdmins();
    return;
  }

  if (!options.email && !options.id) {
    throw new Error("Wajib memberi --email atau --id. Pakai --list untuk melihat admin saat ini.");
  }
  if (options.email && options.id) {
    throw new Error("Pilih salah satu saja: --email atau --id.");
  }
  if (!VALID_ROLES.includes(options.role)) {
    throw new Error(`--role wajib salah satu dari: ${VALID_ROLES.join(", ")}.`);
  }

  // Email disimpan ternormalisasi (lowercase) oleh flow auth.
  const where = options.email
    ? { email: options.email.trim().toLowerCase() }
    : { id: Number(options.id) };

  if (!options.email && !Number.isInteger(where.id)) {
    throw new Error("--id harus berupa angka.");
  }

  const user = await prisma.user.findUnique({
    where,
    select: { id: true, email: true, displayName: true, role: true },
  });

  if (!user) {
    throw new Error("User tidak ditemukan.");
  }

  if (user.role === options.role) {
    log(`#${user.id} ${user.displayName} sudah berrole ${user.role}. Tidak ada perubahan.`);
    return;
  }

  // Menolak demote admin terakhir: tanpa admin sama sekali, satu-satunya jalan
  // kembali adalah menjalankan script ini lagi dengan akses shell ke database.
  if (user.role === "ADMIN" && options.role === "USER") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new Error("Ini admin terakhir. Promote admin lain dulu sebelum menurunkannya.");
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: options.role } });
  log(`#${user.id} ${user.displayName} (${user.email ?? "tanpa email"}): ${user.role} -> ${options.role}`);
}

main()
  .catch((error) => {
    console.error(`[user:role] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
