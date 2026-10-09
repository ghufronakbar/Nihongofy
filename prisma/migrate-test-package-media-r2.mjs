import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  assertSafeFileName,
  loadAndValidateSeedFiles,
  SEED_DATA_DIR,
} from "./test-package-fixture.mjs";

const CLOUDINARY_HOST = "res.cloudinary.com";
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_ASSET_BYTES = 256 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 120_000;
const FETCH_ATTEMPTS = 3;
const PUBLIC_READBACK_ATTEMPTS = 5;

function log(message) {
  console.log(`[migrate:test-media:r2] ${message}`);
}

function usage() {
  return [
    "Penggunaan:",
    "  npm run migrate:test-media:r2 -- --dry-run [--file n5-2012-12.json]",
    "  npm run migrate:test-media:r2 -- --apply [--file n5-2012-12.json]",
    "",
    "Tanpa --apply script hanya menampilkan rencana dan tidak menulis ke R2 atau fixture.",
  ].join("\n");
}

function parseArguments(argv) {
  const options = { apply: false, selectedFile: null };
  let modeWasSet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const consumesNext = !argument.includes("=");
    const readValue = (prefix) =>
      argument.startsWith(`${prefix}=`) ? argument.slice(prefix.length + 1) : argv[index + 1];

    if (argument === "--apply" || argument === "--dry-run") {
      if (modeWasSet) throw new Error("pilih tepat satu dari --apply atau --dry-run");
      options.apply = argument === "--apply";
      modeWasSet = true;
      continue;
    }

    if (argument.startsWith("--file")) {
      const value = readValue("--file");
      if (!value || value.startsWith("--")) throw new Error("--file membutuhkan nama file *.json");
      options.selectedFile = assertSafeFileName(value);
      if (consumesNext) index += 1;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function requireEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`environment ${name} wajib diisi untuk --apply`);
  return value;
}

function createR2Config() {
  const accountId = requireEnvironment("R2_ACCOUNT_ID");
  const accessKeyId = requireEnvironment("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnvironment("R2_SECRET_ACCESS_KEY");
  const bucket = requireEnvironment("R2_BUCKET");
  const publicBaseUrl = requireEnvironment("R2_PUBLIC_BASE_URL").replace(/\/+$/, "");
  const parsedPublicUrl = new URL(publicBaseUrl);

  if (parsedPublicUrl.protocol !== "https:") {
    throw new Error("R2_PUBLIC_BASE_URL harus memakai HTTPS");
  }

  return {
    bucket,
    publicBaseUrl,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    }),
  };
}

function isCloudinaryUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === CLOUDINARY_HOST;
  } catch {
    return false;
  }
}

function addReference(references, owner, field, mediaType, jsonPath) {
  const sourceUrl = owner?.[field];
  if (typeof sourceUrl !== "string" || sourceUrl.length === 0) return;
  references.push({ owner, field, mediaType, jsonPath, sourceUrl });
}

function collectMediaReferences(pkg) {
  const references = [];

  for (const [contextIndex, context] of (pkg.questionContexts ?? []).entries()) {
    addReference(
      references,
      context,
      "storyImage",
      "images",
      `$.questionContexts[${contextIndex}].storyImage`,
    );
    addReference(
      references,
      context,
      "storyAudio",
      "audio",
      `$.questionContexts[${contextIndex}].storyAudio`,
    );
  }

  for (const [itemIndex, item] of pkg.testPackageItems.entries()) {
    for (const [questionIndex, question] of item.questions.entries()) {
      const questionPath = `$.testPackageItems[${itemIndex}].questions[${questionIndex}]`;
      addReference(
        references,
        question,
        "questionImage",
        "images",
        `${questionPath}.questionImage`,
      );
      addReference(
        references,
        question,
        "questionAudio",
        "audio",
        `${questionPath}.questionAudio`,
      );

      for (const [choiceIndex, choice] of question.questionChoices.entries()) {
        addReference(
          references,
          choice,
          "answerImage",
          "images",
          `${questionPath}.questionChoices[${choiceIndex}].answerImage`,
        );
      }
    }
  }

  return references;
}

function groupCloudinaryReferences(references) {
  const groups = new Map();

  for (const reference of references) {
    if (!isCloudinaryUrl(reference.sourceUrl)) continue;
    const existing = groups.get(reference.sourceUrl);
    if (existing && existing.mediaType !== reference.mediaType) {
      throw new Error(`URL dipakai sebagai audio dan gambar: ${reference.sourceUrl}`);
    }
    if (existing) {
      existing.references.push(reference);
    } else {
      groups.set(reference.sourceUrl, {
        sourceUrl: reference.sourceUrl,
        mediaType: reference.mediaType,
        references: [reference],
      });
    }
  }

  return [...groups.values()];
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizedContentType(response) {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function validateContentType(contentType, mediaType, sourceUrl) {
  const expectedPrefix = mediaType === "audio" ? "audio/" : "image/";
  if (!contentType.startsWith(expectedPrefix)) {
    throw new Error(
      `${sourceUrl} mengembalikan content-type ${contentType || "kosong"}; diharapkan ${expectedPrefix}*`,
    );
  }
}

async function wait(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchAsset(url, label, attempts = FETCH_ATTEMPTS) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "error",
        headers: { "accept-encoding": "identity", "user-agent": "nihongofy-r2-migrator/1" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_ASSET_BYTES) {
        throw new Error(`ukuran ${declaredLength} byte melewati batas ${MAX_ASSET_BYTES}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) throw new Error("body kosong");
      if (buffer.length > MAX_ASSET_BYTES) {
        throw new Error(`ukuran ${buffer.length} byte melewati batas ${MAX_ASSET_BYTES}`);
      }

      return { buffer, contentType: normalizedContentType(response) };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(attempt * 750);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${label} gagal diunduh setelah ${attempts} percobaan: ${message}`);
}

const EXTENSION_BY_CONTENT_TYPE = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".webm",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

function sourceBasename(sourceUrl, contentType) {
  const pathname = new URL(sourceUrl).pathname;
  let basename;
  try {
    basename = decodeURIComponent(path.posix.basename(pathname));
  } catch {
    basename = path.posix.basename(pathname);
  }

  basename = basename
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  if (!basename || basename === "." || basename === "..") basename = "asset";

  if (!path.posix.extname(basename)) {
    basename += EXTENSION_BY_CONTENT_TYPE[contentType] ?? "";
  }
  return basename;
}

function objectKey({ fixtureSlug, mediaType, hash, basename }) {
  return `jlpt-exam/test-packages/${fixtureSlug}/${mediaType}/${hash.slice(0, 12)}-${basename}`;
}

function publicUrl(publicBaseUrl, key) {
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function isNotFound(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "$metadata" in error &&
    error.$metadata?.httpStatusCode === 404
  );
}

async function readHead(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function headMatches(head, { bytes, contentType, hash }) {
  return (
    head?.ContentLength === bytes &&
    head.ContentType === contentType &&
    head.CacheControl === CACHE_CONTROL &&
    head.Metadata?.sha256 === hash
  );
}

async function uploadOrReuse({ client, bucket, key, buffer, contentType, hash, fixtureSlug }) {
  let head = await readHead(client, bucket, key);
  let action = "reused";

  if (!headMatches(head, { bytes: buffer.length, contentType, hash })) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: contentType,
        CacheControl: CACHE_CONTROL,
        Metadata: { sha256: hash, source: "cloudinary", fixture: fixtureSlug },
      }),
    );
    action = "uploaded";
    head = await readHead(client, bucket, key);
  }

  if (!head || !headMatches(head, { bytes: buffer.length, contentType, hash })) {
    throw new Error(`HeadObject tidak cocok setelah upload: ${key}`);
  }

  return action;
}

async function verifyPublicReadback(url, expectedHash, expectedBytes) {
  let lastError;

  for (let attempt = 1; attempt <= PUBLIC_READBACK_ATTEMPTS; attempt += 1) {
    try {
      const { buffer } = await fetchAsset(url, "readback R2", 1);
      const actualHash = sha256(buffer);
      if (buffer.length !== expectedBytes) {
        throw new Error(`ukuran ${buffer.length}, seharusnya ${expectedBytes}`);
      }
      if (actualHash !== expectedHash) {
        throw new Error(`SHA-256 ${actualHash}, seharusnya ${expectedHash}`);
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < PUBLIC_READBACK_ATTEMPTS) await wait(attempt * 1_000);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`public CDN readback gagal untuk ${url}: ${message}`);
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function migrateFixture({ file, r2 }) {
  const fixturePath = path.join(SEED_DATA_DIR, file);
  const fixtureSlug = path.basename(file, ".json");
  const pkg = JSON.parse(await fs.readFile(fixturePath, "utf8"));
  const references = collectMediaReferences(pkg);
  const groups = groupCloudinaryReferences(references);

  if (groups.length === 0) {
    log(`${file}: tidak ada URL Cloudinary yang perlu dimigrasikan`);
    return { assets: 0, references: 0, bytes: 0 };
  }

  const results = [];
  let migratedReferences = 0;
  let totalBytes = 0;

  for (const [index, group] of groups.entries()) {
    log(`${file}: aset ${index + 1}/${groups.length}`);
    const { buffer, contentType } = await fetchAsset(group.sourceUrl, "aset Cloudinary");
    validateContentType(contentType, group.mediaType, group.sourceUrl);

    const hash = sha256(buffer);
    const basename = sourceBasename(group.sourceUrl, contentType);
    const key = objectKey({ fixtureSlug, mediaType: group.mediaType, hash, basename });
    const targetUrl = publicUrl(r2.publicBaseUrl, key);
    const action = await uploadOrReuse({
      client: r2.client,
      bucket: r2.bucket,
      key,
      buffer,
      contentType,
      hash,
      fixtureSlug,
    });
    await verifyPublicReadback(targetUrl, hash, buffer.length);

    for (const reference of group.references) {
      reference.owner[reference.field] = targetUrl;
    }

    migratedReferences += group.references.length;
    totalBytes += buffer.length;
    results.push({
      sourceUrl: group.sourceUrl,
      targetUrl,
      objectKey: key,
      mediaType: group.mediaType,
      contentType,
      bytes: buffer.length,
      sha256: hash,
      action,
      references: group.references.map((reference) => reference.jsonPath),
      headVerified: true,
      publicReadbackVerified: true,
    });
  }

  const manifestDir = path.join(SEED_DATA_DIR, "../../docs/pipeline", fixtureSlug);
  const manifestPath = path.join(manifestDir, "r2-media-migration.json");
  const manifest = {
    schemaVersion: 1,
    status: "verified",
    fixture: file,
    packageName: pkg.name,
    migratedAt: new Date().toISOString(),
    bucket: r2.bucket,
    publicBaseUrl: r2.publicBaseUrl,
    cacheControl: CACHE_CONTROL,
    assets: results,
  };

  await fs.mkdir(manifestDir, { recursive: true });
  await writeJsonAtomic(manifestPath, manifest);
  await writeJsonAtomic(fixturePath, pkg);

  log(
    `${file}: VERIFIED ${groups.length} aset / ${migratedReferences} referensi / ${totalBytes} byte`,
  );
  return { assets: groups.length, references: migratedReferences, bytes: totalBytes };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { checkedFiles, seedFiles, emptyFiles, errors } = await loadAndValidateSeedFiles(
    options.selectedFile,
  );

  for (const file of emptyFiles) log(`SKIP ${file}: file kosong`);
  if (errors.length > 0) {
    for (const error of errors) log(`ERROR ${error.file}: ${error.message}`);
    throw new Error(`fixture tidak valid: ${errors.length} error`);
  }

  const inventory = [];
  for (const { file } of seedFiles) {
    const fixturePath = path.join(SEED_DATA_DIR, file);
    const pkg = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    const references = collectMediaReferences(pkg);
    const groups = groupCloudinaryReferences(references);
    inventory.push({
      file,
      assets: groups.length,
      references: groups.reduce((count, group) => count + group.references.length, 0),
    });
  }

  const plannedAssets = inventory.reduce((count, item) => count + item.assets, 0);
  const plannedReferences = inventory.reduce((count, item) => count + item.references, 0);
  log(
    `${options.apply ? "APPLY" : "DRY RUN"}: ${plannedAssets} aset unik / ${plannedReferences} referensi Cloudinary dalam ${checkedFiles} file`,
  );
  for (const item of inventory.filter((candidate) => candidate.assets > 0)) {
    log(`PLAN ${item.file}: ${item.assets} aset / ${item.references} referensi`);
  }

  if (!options.apply) {
    log("Tidak ada file atau object yang diubah. Tambahkan --apply untuk menjalankan migrasi.");
    return;
  }

  const r2 = createR2Config();
  const summary = { assets: 0, references: 0, bytes: 0 };
  try {
    for (const { file } of seedFiles) {
      const result = await migrateFixture({ file, r2 });
      summary.assets += result.assets;
      summary.references += result.references;
      summary.bytes += result.bytes;
    }
  } finally {
    r2.client.destroy();
  }

  log(
    `DONE: ${summary.assets} aset / ${summary.references} referensi / ${summary.bytes} byte terverifikasi`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migrate:test-media:r2] gagal: ${message}`);
  process.exitCode = 1;
});
