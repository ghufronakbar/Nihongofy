"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Clock3, RotateCcw, SkipForward, Timer, TimerOff, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { speakJapanese } from "@/features/study/lib/tts";
import { cn } from "@/lib/utils";
import { formatQuizDuration } from "../quiz/engine";
import { getKotoba, getKotobaByBabs, KOTOBA_BABS, KOTOBA_ENTRIES, type KotobaEntry } from "./data";
import { formatBabs, KOTOBA_TIME_LIMIT, kotobaFront, KotobaQuizSetupSchema, type KotobaFront, type KotobaQuizSession, type KotobaQuizSetup } from "./engine";
import { KotobaResults } from "./kotoba-results";
import { useKotobaQuiz } from "./use-kotoba-quiz";

const LENGTH_LABELS = { "10": "10 kata", "20": "20 kata", all: "Semua" } as const;

type Outcome = "correct" | "wrong" | "skipped" | "timeout";

const OUTCOME_STYLES: Record<Outcome, { back: string; label: string }> = {
  correct: { back: "bg-emerald-100", label: "Benar" },
  wrong: { back: "bg-red-100", label: "Belum tepat" },
  skipped: { back: "bg-amber-100", label: "Dilewati" },
  timeout: { back: "bg-orange-100", label: "Waktu habis" },
};

const OUTCOME_STATUS: Record<Outcome, string> = { correct: "Benar!", wrong: "Belum tepat.", skipped: "Dilewati.", timeout: "Waktu habis." };
const OUTCOME_ICONS: Record<Outcome, ReactNode> = {
  correct: <Check className="size-3.5" />,
  wrong: <X className="size-3.5 text-red-700" />,
  skipped: <SkipForward className="size-3.5" />,
  timeout: <TimerOff className="size-3.5" />,
};

function frontSize(text: string): string {
  const length = Array.from(text).length;
  if (length <= 2) return "text-8xl sm:text-9xl";
  if (length <= 4) return "text-7xl sm:text-8xl";
  if (length <= 7) return "text-5xl sm:text-7xl";
  if (length <= 11) return "text-4xl sm:text-5xl";
  return "text-2xl sm:text-4xl";
}

function backSize(text: string): string {
  const length = Array.from(text).length;
  if (length <= 4) return "text-6xl sm:text-7xl";
  if (length <= 7) return "text-4xl sm:text-5xl";
  if (length <= 11) return "text-3xl sm:text-4xl";
  return "text-xl sm:text-3xl";
}

function speakableKana(entry: KotobaEntry): string {
  return entry.kana.replace(/[〜（）「」？]/g, " ").trim();
}

const TIMER_OPTION = "relative flex min-h-16 cursor-pointer items-center gap-2 rounded-lg border-2 border-neo-ink bg-white px-3 py-2 text-sm font-extrabold has-checked:bg-neo-yellow has-checked:shadow-neo-sm focus-within:outline-3 focus-within:outline-offset-3";

function TimerField({ value, onChange, onBlur, error }: { value: number | null; onChange: (value: number | null) => void; onBlur: () => void; error?: string }) {
  const [text, setText] = useState(String(value ?? KOTOBA_TIME_LIMIT.default));
  // Teks kosong menjadi NaN supaya schema menampilkan pesan, bukan diam-diam kembali ke nol.
  const seconds = (raw: string) => (raw.trim() === "" ? Number.NaN : Number(raw));

  return <fieldset aria-describedby={error ? "kotoba-timer-error" : "kotoba-timer-help"}>
    <legend className="mb-3 text-sm font-extrabold">Timer per kata</legend>
    <div className="grid grid-cols-2 gap-3">
      <label className={TIMER_OPTION}>
        <input type="radio" name="kotoba-timer" className="size-4 shrink-0 accent-black" checked={value === null} onChange={() => onChange(null)} onBlur={onBlur} />Tanpa batas
      </label>
      <label className={TIMER_OPTION}>
        <input type="radio" name="kotoba-timer" className="size-4 shrink-0 accent-black" checked={value !== null} onChange={() => onChange(seconds(text))} onBlur={onBlur} />
        <Input type="number" inputMode="numeric" min={KOTOBA_TIME_LIMIT.min} max={KOTOBA_TIME_LIMIT.max} step={1} value={text} aria-label="Batas waktu per kata dalam detik" aria-invalid={Boolean(error)}
          className="h-10 w-18 border-2 border-neo-ink bg-white px-2 text-center text-base font-extrabold text-black dark:bg-white"
          onFocus={() => { if (value === null) onChange(seconds(text)); }}
          onChange={(event) => { setText(event.target.value); onChange(seconds(event.target.value)); }} onBlur={onBlur} />
        detik
      </label>
    </div>
    {error ? <p id="kotoba-timer-error" role="alert" className="mt-2 text-sm font-bold text-red-700">{error}</p> : <p id="kotoba-timer-help" className="mt-2 text-xs leading-5 text-slate-600">{KOTOBA_TIME_LIMIT.min}–{KOTOBA_TIME_LIMIT.max} detik. Bila waktu habis, kartu dibalik dan kata dicatat &ldquo;waktu habis&rdquo;.</p>}
  </fieldset>;
}

function KotobaSetupForm({ defaults, ready, onStart }: { defaults: KotobaQuizSetup; ready: boolean; onStart: (setup: KotobaQuizSetup) => void }) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<KotobaQuizSetup>({ resolver: zodResolver(KotobaQuizSetupSchema), defaultValues: defaults });
  const babs = useWatch({ control, name: "babs" });
  const poolSize = getKotobaByBabs(babs).length;

  return <div className="grid items-center gap-10 py-5 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-12">
    <div>
      <span className="neo-kicker">Kana lab / Tebak kotoba</span>
      <h1 className="mt-6 text-5xl leading-[1.02] tracking-tighter sm:text-7xl">Kotoba per bab.<br />Masih ingat artinya?</h1>
      <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Kosakata Minna no Nihongo I. Lihat katanya, tebak artinya, lalu balik kartunya untuk melihat tulisan lengkap.</p>
      <dl className="mt-8 grid max-w-md grid-cols-3 border-y-2 border-neo-ink py-5">
        {[[String(KOTOBA_BABS.length), "bab tersedia"], [String(KOTOBA_ENTRIES.length), "kotoba"], ["4", "pilihan / soal"]].map(([value, label]) => <div key={label}><dt className="text-2xl font-black sm:text-3xl">{value}</dt><dd className="mt-1 text-xs text-muted-foreground">{label}</dd></div>)}
      </dl>
      <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Tanpa login. Kata yang salah bisa langsung diulang setelah selesai.</p>
    </div>
    <section className="relative rounded-lg border-[3px] border-neo-ink bg-white text-neo-ink shadow-neo-lg" aria-labelledby="kotoba-setup-title">
      <div className="flex items-center justify-between gap-4 border-b-[3px] border-neo-ink bg-neo-blue px-5 py-4 sm:px-7">
        <h2 id="kotoba-setup-title" className="text-2xl">Atur kartumu</h2><span lang="ja" className="font-japanese text-4xl" aria-hidden="true">語</span>
      </div>
      <form noValidate className="space-y-6 p-5 sm:p-7" onSubmit={handleSubmit(onStart)}>
        <div>
          <label htmlFor="kotoba-nickname" className="block text-sm font-extrabold">Nickname kamu</label>
          <Input id="kotoba-nickname" className="neo-input mt-2 h-12 bg-white text-black dark:bg-white md:text-base" placeholder="Nama yang akan tampil di hasil" autoComplete="nickname" maxLength={32} aria-invalid={Boolean(errors.nickname)} aria-describedby={errors.nickname ? "kotoba-nickname-error" : undefined} {...register("nickname")} />
          {errors.nickname && <p id="kotoba-nickname-error" role="alert" className="mt-2 text-sm font-bold text-red-700">{errors.nickname.message}</p>}
        </div>
        <Controller control={control} name="babs" render={({ field }) => <fieldset aria-describedby={errors.babs ? "kotoba-babs-error" : undefined}>
          <legend className="mb-3 text-sm font-extrabold">Bab Minna no Nihongo</legend>
          <div className="grid grid-cols-5 gap-2">
            {KOTOBA_BABS.map((bab) => <label key={bab} className="relative flex cursor-pointer flex-col items-center rounded-lg border-2 border-neo-ink bg-white px-1 py-3 has-checked:bg-neo-yellow has-checked:shadow-neo-sm focus-within:outline-3 focus-within:outline-offset-3">
              <input type="checkbox" className="sr-only" checked={field.value.includes(bab)} onBlur={field.onBlur} onChange={(event) => field.onChange(event.target.checked ? [...field.value, bab].sort((a, b) => a - b) : field.value.filter((item) => item !== bab))} />
              <span className="text-2xl font-black">{bab}</span>
              <span className="mt-0.5 text-[10px] font-bold text-slate-600">{getKotobaByBabs([bab]).length} kata</span>
            </label>)}
          </div>
          {errors.babs ? <p id="kotoba-babs-error" role="alert" className="mt-2 text-sm font-bold text-red-700">{errors.babs.message}</p> : <p className="mt-2 text-xs text-slate-600">Boleh pilih lebih dari satu bab.</p>}
        </fieldset>} />
        <fieldset>
          <legend className="mb-3 text-sm font-extrabold">Tampilan depan kartu</legend>
          <div className="grid grid-cols-2 gap-3">
            {([["kana", "わたし", "Hiragana / katakana"], ["kanji", "私", "Kanji"]] as const).map(([value, sample, label]) => <label key={value} className="relative flex cursor-pointer items-center gap-2 rounded-lg border-2 border-neo-ink bg-white px-3 py-4 has-checked:bg-neo-yellow has-checked:shadow-neo-sm focus-within:outline-3 focus-within:outline-offset-3 sm:gap-3">
              <input type="radio" value={value} className="size-4 shrink-0 accent-black" {...register("front")} /><span><span lang="ja" className="font-japanese block text-2xl">{sample}</span><span className="mt-1 block text-xs font-extrabold sm:text-sm">{label}</span></span>
            </label>)}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">Bagian belakang selalu lengkap: kana, kanji, dan arti. Kata tanpa kanji tetap tampil dalam kana.</p>
        </fieldset>
        <fieldset>
          <legend className="mb-3 text-sm font-extrabold">Jumlah soal</legend>
          <div className="grid grid-cols-3 gap-3">
            {(["10", "20", "all"] as const).map((value) => <label key={value} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-2 border-neo-ink bg-white px-1.5 py-3 text-xs font-extrabold sm:gap-2 sm:px-2 sm:text-sm has-checked:bg-neo-yellow has-checked:shadow-neo-sm focus-within:outline-3 focus-within:outline-offset-3">
              <input type="radio" value={value} className="size-4 accent-black" {...register("length")} />{value === "all" ? `Semua (${poolSize})` : LENGTH_LABELS[value]}
            </label>)}
          </div>
        </fieldset>
        <Controller control={control} name="timeLimit" render={({ field }) => <TimerField value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors.timeLimit?.message} />} />
        <Button type="submit" disabled={!ready} className="neo-button h-13 w-full border-[3px] border-neo-ink bg-neo-yellow text-base font-extrabold text-neo-ink">{ready ? "Mulai tebak kotoba" : "Menyiapkan kartu…"}<ArrowRight className="size-5" /></Button>
        <p className="text-[11px] leading-5 text-slate-500">Urutan kata dan pilihan diacak. Pengecoh diambil dari kata sejenis di bab yang dipilih, misalnya sesama nama hari atau tanggal.</p>
      </form>
    </section>
  </div>;
}

function KotobaCard({ entry, front, flipped, outcome, title }: { entry: KotobaEntry; front: KotobaFront; flipped: boolean; outcome: Outcome | null; title: Ref<HTMLHeadingElement> }) {
  const [speech, setSpeech] = useState("");
  const shown = kotobaFront(entry, front);
  const other = shown === entry.kana ? entry.kanji : entry.kana;

  return <div className={cn("kana-flip-card h-72 sm:h-80", flipped && "is-flipped")}>
    <div className="kana-flip-card-inner motion-reduce:transition-none">
      <section inert={flipped} aria-hidden={flipped} className="kana-flip-face flex flex-col items-center justify-center rounded-lg border-[3px] border-neo-ink bg-white px-6 py-6 text-neo-ink shadow-neo">
        <p className="absolute top-4 left-4 font-mono text-[10px] font-bold tracking-widest uppercase text-slate-500">Bab {entry.bab}</p>
        <p className="absolute top-4 right-4 font-mono text-[10px] font-bold tracking-widest uppercase text-slate-500">{shown === entry.kana ? "Kana" : "Kanji"}</p>
        <h1 ref={flipped ? undefined : title} tabIndex={-1} className={cn("font-japanese max-w-full text-center leading-tight font-normal break-words outline-none", frontSize(shown))}><span lang="ja">{shown}</span></h1>
        <p className="mt-4 text-xs font-semibold text-slate-500">Apa artinya?</p>
      </section>
      <section inert={!flipped} aria-hidden={!flipped} className={cn("kana-flip-face kana-flip-back flex flex-col items-center justify-center rounded-lg border-[3px] border-neo-ink px-6 py-6 text-neo-ink shadow-neo", OUTCOME_STYLES[outcome ?? "correct"].back)}>
        <p className="absolute top-4 left-4 flex items-center gap-1 border-2 border-neo-ink bg-white px-2 py-0.5 text-xs font-black uppercase">{OUTCOME_ICONS[outcome ?? "correct"]}{OUTCOME_STYLES[outcome ?? "correct"].label}</p>
        <Button type="button" variant="ghost" className="absolute top-2.5 right-2.5 min-h-10 text-xs font-bold" onClick={() => { const result = speakJapanese(speakableKana(entry)); setSpeech(result.ok ? "" : result.message); }}><Volume2 className="size-4" />Dengar</Button>
        <p lang="ja" className={cn("font-japanese max-w-full text-center leading-tight break-words", backSize(shown))}>{shown}</p>
        {other && <p lang="ja" className="font-japanese mt-2 text-xl text-slate-700 sm:text-2xl">{other}</p>}
        <p className="mt-4 max-w-md text-center text-lg leading-snug font-extrabold sm:text-xl">{entry.meaning}</p>
        {entry.note && <p className="mt-2 max-w-md text-center text-xs leading-5 text-slate-700 sm:text-sm">{entry.note}</p>}
        {speech && <p role="status" className="absolute bottom-3 px-4 text-center text-[11px] text-slate-700">{speech}</p>}
      </section>
    </div>
  </div>;
}

function KotobaRound({ session, onAnswer, onAdvance, onReset }: { session: KotobaQuizSession; onAnswer: (key: string, selectedKey: string | null) => void; onAdvance: () => void; onReset: () => void }) {
  const pending = session.questionStartedAt === null;
  const revealing = pending && session.answers.length > 0;
  const index = revealing ? session.answers.length - 1 : session.answers.length;
  const question = session.questions[index];
  const entry = getKotoba(question.key);
  const answer = revealing ? session.answers[index] : undefined;
  const isLast = index === session.questions.length - 1;
  const title = useRef<HTMLHeadingElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resetOpen, setResetOpen] = useState(false);
  const elapsedMs = pending ? (answer?.elapsedMs ?? 0) : Math.max(0, now - (session.questionStartedAt ?? now));
  const limitMs = session.timeLimit === null ? null : session.timeLimit * 1000;
  const leftMs = limitMs === null ? null : Math.max(0, limitMs - elapsedMs);
  // Peringatan merah di 3 detik terakhir, atau 30% terakhir untuk timer yang sangat pendek.
  const lowTime = leftMs !== null && limitMs !== null && !pending && leftMs <= Math.min(3000, limitMs * 0.3);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (revealing) next.current?.focus({ preventScroll: true });
    else title.current?.focus({ preventScroll: true });
  }, [index, revealing]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || resetOpen || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const option = ["1", "2", "3", "4"].indexOf(event.key);
      if (!pending && option >= 0) {
        event.preventDefault();
        onAnswer(question.key, question.options[option]);
      } else if (!pending && event.key.toLowerCase() === "l") {
        event.preventDefault();
        onAnswer(question.key, null);
      } else if (revealing && event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
        // A focused button already turns Enter into its own click.
        event.preventDefault();
        onAdvance();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onAnswer, onAdvance, pending, question, resetOpen, revealing]);

  if (!entry) return null;
  const outcome: Outcome | null = !answer ? null
    : answer.selectedKey === null ? (limitMs !== null && answer.elapsedMs >= limitMs ? "timeout" : "skipped")
    : answer.selectedKey === answer.key ? "correct" : "wrong";

  return <div className="mx-auto max-w-2xl pb-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-xs font-extrabold tracking-wider uppercase">Tebak kotoba · {formatBabs(session.babs)}</p><p className="mt-1 max-w-56 truncate text-sm text-muted-foreground" title={session.nickname}>{session.nickname}</p></div>
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogTrigger render={<Button variant="ghost" className="min-h-10 text-xs font-bold" />}><RotateCcw className="size-3.5" />Ubah pengaturan</AlertDialogTrigger>
        <AlertDialogContent className="border-[3px] border-neo-ink"><AlertDialogHeader><AlertDialogTitle>Hentikan sesi ini?</AlertDialogTitle><AlertDialogDescription>Jawaban sesi ini akan dihapus. Kamu bisa memilih bab dan tampilan kartu lagi.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Lanjutkan sesi</AlertDialogCancel><AlertDialogAction onClick={onReset}>Ubah pengaturan</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
    <div className="mb-3 flex items-center justify-between font-mono text-xs font-bold"><span>KATA {String(index + 1).padStart(2, "0")} / {session.questions.length}</span>{leftMs === null
      ? <span className="flex items-center gap-1.5 tabular-nums" aria-label={`Waktu soal ${formatQuizDuration(elapsedMs)}`}><Clock3 className="size-3.5" />{formatQuizDuration(elapsedMs)}</span>
      : <span className={cn("flex items-center gap-1.5 tabular-nums", lowTime && "text-red-700")} aria-label={`Sisa waktu ${Math.ceil(leftMs / 1000)} detik dari ${session.timeLimit}`}><Timer className="size-3.5" />{Math.ceil(leftMs / 1000)} / {session.timeLimit} dtk</span>}</div>
    <div role="progressbar" aria-label="Progres tebak kotoba" aria-valuemin={0} aria-valuemax={session.questions.length} aria-valuenow={session.answers.length} className={cn("h-2.5 overflow-hidden rounded-full border-2 border-neo-ink bg-card", limitMs === null ? "mb-5" : "mb-2")}><div className="h-full bg-neo-blue" style={{ width: `${session.answers.length / session.questions.length * 100}%` }} /></div>
    {leftMs !== null && limitMs !== null && <div aria-hidden="true" className="mb-5 h-1.5 overflow-hidden rounded-full bg-neo-ink/10"><div className={cn("h-full transition-[width] duration-200 ease-linear motion-reduce:transition-none", lowTime ? "bg-neo-coral" : "bg-neo-green")} style={{ width: `${leftMs / limitMs * 100}%` }} /></div>}
    <KotobaCard key={entry.key} entry={entry} front={session.front} flipped={revealing} outcome={outcome} title={title} />
    <div className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-label="Pilihan arti">
      {question.options.map((optionKey, option) => {
        const meaning = getKotoba(optionKey)?.meaning ?? "";
        const isKey = optionKey === question.key;
        const isChosen = answer?.selectedKey === optionKey;
        return <Button key={`${question.key}-${optionKey}`} disabled={pending} onClick={() => onAnswer(question.key, optionKey)} className={cn("neo-button relative h-auto min-h-16 justify-start border-[3px] border-neo-ink bg-white py-3 pr-9 pl-9 text-left text-sm leading-snug font-extrabold whitespace-normal text-neo-ink disabled:opacity-70 sm:text-base", revealing && isKey && "bg-emerald-200 disabled:opacity-100", revealing && isChosen && !isKey && "bg-red-200 disabled:opacity-100")}>
          <span className="absolute top-2 left-2.5 font-mono text-[10px] text-slate-500" aria-hidden="true">{option + 1}</span>
          {meaning}
          {revealing && isKey && <Check className="absolute right-3 size-4" aria-label="Kunci jawaban" />}
          {revealing && isChosen && !isKey && <X className="absolute right-3 size-4 text-red-700" aria-label="Pilihanmu" />}
        </Button>;
      })}
    </div>
    {!revealing && <Button variant="outline" disabled={pending} onClick={() => onAnswer(question.key, null)} className="mt-3 min-h-11 w-full border-2 border-dashed border-neo-ink bg-transparent font-bold"><SkipForward className="size-4" />Lewati, saya belum tahu<kbd className="ml-1 rounded-sm border border-neo-ink/40 px-1.5 font-mono text-[10px]">L</kbd></Button>}
    {revealing && <Button ref={next} onClick={onAdvance} className="neo-button mt-5 h-13 w-full border-[3px] border-neo-ink bg-neo-yellow text-base font-extrabold text-neo-ink">{isLast ? "Lihat hasil" : "Lanjut"}<ArrowRight className="size-5" /></Button>}
    <p role="status" aria-live="polite" className="mt-4 min-h-5 text-center text-xs text-muted-foreground">
      {revealing ? `${OUTCOME_STATUS[outcome ?? "correct"]} ${entry.kana} artinya “${entry.meaning}”. Tekan Enter untuk ${isLast ? "melihat hasil" : "lanjut"}.` : "Pilih arti yang tepat dengan tombol 1–4, atau tekan L untuk melewati."}
    </p>
  </div>;
}

export function KotobaQuiz({ initialBabs }: { initialBabs: number[] }) {
  const quiz = useKotobaQuiz();
  const [defaults, setDefaults] = useState<KotobaQuizSetup>({ nickname: "", babs: initialBabs, front: "kana", length: "all", timeLimit: null });

  function setupOf(session: KotobaQuizSession): KotobaQuizSetup {
    return { nickname: session.nickname, babs: session.babs, front: session.front, length: session.length, timeLimit: session.timeLimit };
  }

  function changeSettings() {
    if (quiz.session) setDefaults(setupOf(quiz.session));
    quiz.reset();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function restart(onlyKeys?: string[]) {
    if (!quiz.session) return;
    const setup = setupOf(quiz.session);
    quiz.start(onlyKeys ? { ...setup, length: "all" } : setup, onlyKeys);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const active = quiz.session && quiz.session.finishedAt === null;

  return <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
    <nav aria-label="Navigasi tebak kotoba" className="mb-6 flex items-center justify-between gap-3">
      <Link href="/kana/hiragana" className="inline-flex min-h-10 items-center gap-2 text-sm font-bold"><ArrowLeft className="size-4" />Kana Lab</Link>
      <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Lihat. Tebak. Balik.</span>
    </nav>
    {quiz.storageWarning && <p role="status" className="mx-auto mb-5 max-w-4xl border-2 border-neo-ink bg-neo-yellow px-4 py-3 text-sm text-neo-ink">Penyimpanan tab tidak tersedia. Kartu tetap bisa dimainkan; hindari refresh sebelum selesai.</p>}
    {quiz.restored && active && <p role="status" className="mx-auto mb-5 max-w-2xl text-xs leading-5 text-muted-foreground">Sesi sebelumnya dipulihkan. Waktu soal tetap berjalan saat refresh.</p>}
    {quiz.session
      ? (quiz.session.finishedAt !== null
        ? <KotobaResults session={quiz.session} onRetry={() => restart()} onRetryMistakes={(keys) => restart(keys)} onChangeSettings={changeSettings} />
        : <KotobaRound session={quiz.session} onAnswer={quiz.answer} onAdvance={quiz.advance} onReset={changeSettings} />)
      : <KotobaSetupForm key={JSON.stringify(defaults)} defaults={defaults} ready={quiz.ready} onStart={(setup) => { quiz.start(setup); window.scrollTo({ top: 0, behavior: "instant" }); }} />}
  </div>;
}
