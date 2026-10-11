import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { SEED_DATA_DIR } from "./test-package-fixture.mjs";

const execFileAsync = promisify(execFile);
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const FETCH_TIMEOUT_MS = 120_000;
const READBACK_ATTEMPTS = 5;
const EXPECTED_MONDAI_TYPES = new Set([
  "CHOUKAI_TASK_BASED",
  "CHOUKAI_MAIN_POINT",
  "CHOUKAI_EXPRESSION",
  "CHOUKAI_QUICK_RESPONSE",
]);

function log(message) {
  console.log(`[segment:question-audio] ${message}`);
}

function parseArguments(argv) {
  const options = {
    apply: false,
    manifest: "docs/pipeline/n5-question-audio-timestamps.json",
  };
  let modeSet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply" || argument === "--dry-run") {
      if (modeSet) throw new Error("pilih tepat satu dari --apply atau --dry-run");
      options.apply = argument === "--apply";
      modeSet = true;
      continue;
    }
    if (argument === "--manifest") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--manifest membutuhkan path JSON");
      options.manifest = value;
      index += 1;
      continue;
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

function timestampSeconds(value) {
  const match = /^(\d+):(\d{2})$/.exec(value);
  if (!match) throw new Error(`timestamp tidak valid: ${value}`);
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  if (!Number.isFinite(seconds)) throw new Error(`timestamp tidak valid: ${value}`);
  return seconds;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function publicUrl(baseUrl, key) {
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function isNotFound(error) {
  return error?.$metadata?.httpStatusCode === 404;
}

async function readHead(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function headMatches(head, bytes, hash) {
  return (
    head?.ContentLength === bytes &&
    head.ContentType === "audio/mpeg" &&
    head.CacheControl === CACHE_CONTROL &&
    head.Metadata?.sha256 === hash
  );
}

async function uploadOrReuse({ r2, key, buffer, hash, fixture }) {
  let head = await readHead(r2.client, r2.bucket, key);
  let action = "reused";

  if (!headMatches(head, buffer.length, hash)) {
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: buffer,
        ContentLength: buffer.length,
        ContentType: "audio/mpeg",
        CacheControl: CACHE_CONTROL,
        Metadata: {
          sha256: hash,
          source: "question-audio-segmentation",
          fixture,
        },
      }),
    );
    action = "uploaded";
    head = await readHead(r2.client, r2.bucket, key);
  }

  if (!headMatches(head, buffer.length, hash)) {
    throw new Error(`HeadObject tidak cocok setelah upload: ${key}`);
  }
  return action;
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    headers: { "accept-encoding": "identity", "user-agent": "nihongofy-audio-segmenter/1" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} mengembalikan HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error(`${url} mengembalikan body kosong`);
  return buffer;
}

async function verifyReadback(url, expectedBuffer) {
  const expectedHash = sha256(expectedBuffer);
  let lastError;
  for (let attempt = 1; attempt <= READBACK_ATTEMPTS; attempt += 1) {
    try {
      const actual = await fetchBuffer(url);
      if (actual.length !== expectedBuffer.length || sha256(actual) !== expectedHash) {
        throw new Error("byte atau SHA-256 readback tidak cocok");
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < READBACK_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
      }
    }
  }
  throw lastError;
}

async function probeAudio(input) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
    "-of", "json",
    input,
  ]);
  const result = JSON.parse(stdout);
  return {
    duration: Number(result.format?.duration),
    codec: result.streams?.[0]?.codec_name,
    sampleRate: Number(result.streams?.[0]?.sample_rate),
    channels: Number(result.streams?.[0]?.channels),
  };
}

async function segmentAudio({ sourcePath, outputPath, start, end }) {
  await execFileAsync("ffmpeg", [
    "-v", "error",
    "-y",
    "-ss", String(start),
    "-i", sourcePath,
    "-t", String(end - start),
    "-map", "0:a:0",
    "-map_metadata", "-1",
    "-codec:a", "libmp3lame",
    "-ac", "1",
    "-ar", "32000",
    "-b:a", "64k",
    outputPath,
  ]);
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function loadPlan(manifestPath) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.packages)) {
    throw new Error("manifest timestamp tidak memakai schemaVersion 1");
  }

  const plan = [];
  for (const packageEntry of manifest.packages) {
    const fixturePath = path.join(SEED_DATA_DIR, packageEntry.fixture);
    const pkg = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    const fixtureSlug = path.basename(packageEntry.fixture, ".json");

    if (!Array.isArray(packageEntry.mondai) || packageEntry.mondai.length !== 4) {
      throw new Error(`${packageEntry.fixture}: harus memiliki 4 mondai Choukai`);
    }

    for (const mondai of packageEntry.mondai) {
      if (!EXPECTED_MONDAI_TYPES.has(mondai.mondaiType)) {
        throw new Error(`${packageEntry.fixture}: mondaiType tidak didukung ${mondai.mondaiType}`);
      }
      const item = pkg.testPackageItems.find((candidate) => candidate.mondaiType === mondai.mondaiType);
      if (!item) throw new Error(`${packageEntry.fixture}: ${mondai.mondaiType} tidak ditemukan`);
      if (item.questions.length !== mondai.clips.length) {
        throw new Error(
          `${packageEntry.fixture}: ${mondai.mondaiType} memiliki ${item.questions.length} soal tetapi ${mondai.clips.length} timestamp`,
        );
      }

      const contextRefs = new Set(item.questions.map((question) => question.questionContextRef));
      if (contextRefs.size !== 1 || contextRefs.has(undefined)) {
        throw new Error(`${packageEntry.fixture}: ${mondai.mondaiType} tidak memakai satu context yang konsisten`);
      }
      const contextRef = [...contextRefs][0];
      const context = pkg.questionContexts.find((candidate) => candidate.id === contextRef);
      if (context?.storyAudio !== mondai.sourceUrl) {
        throw new Error(`${packageEntry.fixture}: sourceUrl ${mondai.mondaiType} tidak sama dengan storyAudio fixture`);
      }

      const clips = mondai.clips.map(([startText, endText], index) => {
        const start = timestampSeconds(startText);
        const end = timestampSeconds(endText);
        if (end <= start) {
          throw new Error(`${packageEntry.fixture}: ${mondai.mondaiType}#${index + 1} end <= start`);
        }
        return { order: index + 1, startText, endText, start, end };
      });
      for (let index = 1; index < clips.length; index += 1) {
        const overlap = clips[index - 1].end - clips[index].start;
        if (overlap > 0) {
          log(`WARN ${packageEntry.fixture} ${mondai.mondaiType} #${index}->#${index + 1} overlap ${overlap}s`);
        }
      }

      plan.push({
        fixture: packageEntry.fixture,
        fixturePath,
        fixtureSlug,
        pkg,
        item,
        mondaiType: mondai.mondaiType,
        sourceUrl: mondai.sourceUrl,
        clips,
      });
    }
  }
  return plan;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifestPath = path.resolve(options.manifest);
  const plan = await loadPlan(manifestPath);
  const clipCount = plan.reduce((total, group) => total + group.clips.length, 0);
  log(`${options.apply ? "APPLY" : "DRY RUN"}: ${plan.length} mondai / ${clipCount} soal`);

  const sourceProbes = new Map();
  for (const group of plan) {
    if (!sourceProbes.has(group.sourceUrl)) {
      const probe = await probeAudio(group.sourceUrl);
      if (!Number.isFinite(probe.duration) || probe.codec !== "mp3") {
        throw new Error(`${group.sourceUrl}: sumber bukan MP3 valid`);
      }
      sourceProbes.set(group.sourceUrl, probe);
    }
    const probe = sourceProbes.get(group.sourceUrl);
    const maximumEnd = Math.max(...group.clips.map((clip) => clip.end));
    if (maximumEnd > probe.duration + 0.1) {
      throw new Error(`${group.fixture} ${group.mondaiType}: end ${maximumEnd}s melewati durasi ${probe.duration}s`);
    }
  }

  if (!options.apply) {
    log("VALID: seluruh timestamp, fixture, source URL, dan durasi cocok; tidak ada perubahan.");
    return;
  }

  const r2 = createR2Config();
  const temporaryDir = await fs.mkdtemp(path.join(os.tmpdir(), "nihongofy-question-audio-"));
  const packages = new Map();
  try {
    for (const [groupIndex, group] of plan.entries()) {
      log(`${groupIndex + 1}/${plan.length} ${group.fixture} ${group.mondaiType}: download dan trim`);
      const sourceBuffer = await fetchBuffer(group.sourceUrl);
      const sourceHash = sha256(sourceBuffer);
      const sourcePath = path.join(temporaryDir, `${group.fixtureSlug}-${group.mondaiType}.mp3`);
      await fs.writeFile(sourcePath, sourceBuffer);

      const packageResult = packages.get(group.fixture) ?? {
        schemaVersion: 1,
        status: "verified",
        fixture: group.fixture,
        packageName: group.pkg.name,
        generatedAt: new Date().toISOString(),
        cacheControl: CACHE_CONTROL,
        assets: [],
      };
      packages.set(group.fixture, packageResult);

      for (const clip of group.clips) {
        const outputName = `${group.fixtureSlug}-${group.mondaiType.toLowerCase().replaceAll("_", "-")}-q${String(clip.order).padStart(2, "0")}.mp3`;
        const outputPath = path.join(temporaryDir, outputName);
        await segmentAudio({ sourcePath, outputPath, start: clip.start, end: clip.end });
        const outputBuffer = await fs.readFile(outputPath);
        const outputHash = sha256(outputBuffer);
        const key = `jlpt-exam/test-packages/${group.fixtureSlug}/audio/${outputHash.slice(0, 12)}-${outputName}`;
        const url = publicUrl(r2.publicBaseUrl, key);
        const action = await uploadOrReuse({
          r2,
          key,
          buffer: outputBuffer,
          hash: outputHash,
          fixture: group.fixtureSlug,
        });
        await verifyReadback(url, outputBuffer);

        const probe = await probeAudio(outputPath);
        const expectedDuration = clip.end - clip.start;
        if (Math.abs(probe.duration - expectedDuration) > 0.1) {
          throw new Error(`${outputName}: durasi ${probe.duration}s, expected ${expectedDuration}s`);
        }
        if (probe.codec !== "mp3" || probe.sampleRate !== 32000 || probe.channels !== 1) {
          throw new Error(`${outputName}: format output tidak sesuai MP3/32kHz/mono`);
        }

        const question = group.item.questions.find((candidate) => candidate.order === clip.order);
        question.questionAudio = url;
        packageResult.assets.push({
          mondaiType: group.mondaiType,
          questionOrder: clip.order,
          sourceUrl: group.sourceUrl,
          sourceSha256: sourceHash,
          start: clip.startText,
          end: clip.endText,
          intendedDuration: expectedDuration,
          outputDuration: probe.duration,
          bytes: outputBuffer.length,
          sha256: outputHash,
          objectKey: key,
          publicUrl: url,
          action,
          headVerified: true,
          publicReadbackVerified: true,
        });
      }
    }

    for (const [fixture, result] of packages) {
      const group = plan.find((candidate) => candidate.fixture === fixture);
      await writeJsonAtomic(group.fixturePath, group.pkg);
      await writeJsonAtomic(
        path.resolve("docs/pipeline", group.fixtureSlug, "manifests/question-audio-upload-results.json"),
        result,
      );
      log(`${fixture}: fixture dan manifest upload diperbarui (${result.assets.length} audio)`);
    }
  } finally {
    r2.client.destroy();
    await fs.rm(temporaryDir, { recursive: true, force: true });
  }

  log(`DONE: ${clipCount} audio telah di-upload, dibaca ulang, dan ditulis ke fixture.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[segment:question-audio] gagal: ${message}`);
  process.exitCode = 1;
});
