"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, Clock3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { KanaScript } from "../data/kana";
import { getKanaByScript } from "../data/kana";
import { formatQuizDuration, QUIZ_LENGTH, QuizSetupSchema, type QuizSession, type QuizSetup } from "./engine";
import { QuizResults } from "./quiz-results";
import { useKanaQuiz } from "./use-kana-quiz";

function QuizSetupForm({ defaults, ready, onStart }: { defaults: QuizSetup; ready: boolean; onStart: (setup: QuizSetup) => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<QuizSetup>({ resolver: zodResolver(QuizSetupSchema), defaultValues: defaults });

  return <div className="grid items-center gap-10 py-5 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:py-12">
    <div>
      <span className="neo-kicker">Kana lab / Quiz</span>
      <h1 className="mt-6 text-5xl leading-[1.02] tracking-tighter sm:text-7xl">46 kana.<br />Seberapa hafal?</h1>
      <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">Kenali hurufnya, pilih cara bacanya. Lihat kana yang sudah dikuasai dan yang masih sering tertukar.</p>
      <dl className="mt-8 grid max-w-md grid-cols-3 border-y-2 border-neo-ink py-5">
        {[["46", "kana dasar"], ["4", "pilihan / soal"], ["Bebas", "batas waktu"]].map(([value, label]) => <div key={label}><dt className="text-2xl font-black sm:text-3xl">{value}</dt><dd className="mt-1 text-xs text-muted-foreground">{label}</dd></div>)}
      </dl>
      <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Tanpa login. Hasil akhir bisa diunduh dan dikirim ke pengajar.</p>
    </div>
    <section className="relative rounded-lg border-[3px] border-neo-ink bg-white text-neo-ink shadow-neo-lg" aria-labelledby="quiz-setup-title">
      <div className="flex items-center justify-between gap-4 border-b-[3px] border-neo-ink bg-neo-blue px-5 py-4 sm:px-7">
        <h2 id="quiz-setup-title" className="text-2xl">Siap menguji ingatan?</h2><span lang="ja" className="font-japanese text-4xl" aria-hidden="true">あ</span>
      </div>
      <form className="space-y-6 p-5 sm:p-7" onSubmit={handleSubmit(onStart)}>
        <div>
          <label htmlFor="quiz-nickname" className="block text-sm font-extrabold">Nickname kamu</label>
          <Input id="quiz-nickname" className="neo-input mt-2 h-12 bg-white text-black dark:bg-white md:text-base" placeholder="Nama yang akan tampil di hasil" autoComplete="nickname" maxLength={32} aria-invalid={Boolean(errors.nickname)} aria-describedby={errors.nickname ? "quiz-nickname-error" : "quiz-nickname-help"} {...register("nickname")} />
          {errors.nickname ? <p id="quiz-nickname-error" role="alert" className="mt-2 text-sm font-bold text-red-700">{errors.nickname.message}</p> : <p id="quiz-nickname-help" className="mt-2 text-xs text-slate-600">Bebas pakai nama atau panggilan, maksimal 32 karakter.</p>}
        </div>
        <fieldset>
          <legend className="mb-3 text-sm font-extrabold">Pilih kana yang ingin diuji</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["hiragana", "katakana"] as const).map((script) => <label key={script} className="relative flex cursor-pointer items-center gap-2 rounded-lg border-2 border-neo-ink bg-white px-3 py-4 has-checked:bg-neo-yellow has-checked:shadow-neo-sm focus-within:outline-3 focus-within:outline-offset-3 sm:gap-3">
              <input type="radio" value={script} className="size-4 accent-black" {...register("script")} /><span><span lang="ja" className="font-japanese block text-3xl">{script === "hiragana" ? "あ" : "ア"}</span><span className="mt-1 block text-xs font-extrabold capitalize sm:text-sm">{script}</span></span>
            </label>)}
          </div>
        </fieldset>
        <ul className="space-y-2 text-xs leading-5 text-slate-600">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />Semua 46 kana muncul sekali, dengan urutan acak.</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" />Jawaban dan pembahasan muncul setelah selesai.</li>
          <li className="flex gap-2"><Clock3 className="mt-0.5 size-4 shrink-0" />Waktu tiap jawaban dicatat tanpa mengurangi nilai.</li>
        </ul>
        <Button type="submit" disabled={!ready} className="neo-button h-13 w-full border-[3px] border-neo-ink bg-neo-yellow text-base font-extrabold text-neo-ink">{ready ? "Mulai quiz" : "Menyiapkan quiz…"}<ArrowRight className="size-5" /></Button>
        <p className="text-[11px] leading-5 text-slate-500">Romaji mengikuti tabel kana: shi, chi, tsu, fu; を / ヲ ditulis wo. Quiz mencakup kana dasar tanpa dakuten atau kombinasi.</p>
      </form>
    </section>
  </div>;
}

function QuizRound({ session, onAnswer, onReset }: { session: QuizSession; onAnswer: (key: string, reading: string) => void; onReset: () => void }) {
  const pending = session.questionStartedAt === null;
  const index = pending && session.answers.length > 0 ? session.answers.length - 1 : session.answers.length;
  const question = session.questions[index];
  const card = getKanaByScript(session.script).find((item) => item.key === question.kanaKey);
  const title = useRef<HTMLHeadingElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [resetOpen, setResetOpen] = useState(false);
  const previous = session.answers[index];
  const elapsedMs = pending ? (previous?.elapsedMs ?? 0) : Math.max(0, now - (session.questionStartedAt ?? now));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [index]);

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      const option = ["1", "2", "3", "4"].indexOf(event.key);
      if (!pending && !resetOpen && option >= 0) {
        event.preventDefault();
        onAnswer(question.kanaKey, question.options[option]);
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [onAnswer, pending, question, resetOpen]);

  if (!card) return null;

  return <div className="mx-auto max-w-2xl pb-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-xs font-extrabold tracking-wider uppercase">Quiz {session.script}</p><p className="mt-1 max-w-56 truncate text-sm text-muted-foreground" title={session.nickname}>{session.nickname}</p></div>
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}><AlertDialogTrigger render={<Button variant="ghost" className="min-h-10 text-xs font-bold" />}><RotateCcw className="size-3.5" />Mulai ulang</AlertDialogTrigger>
        <AlertDialogContent className="border-[3px] border-neo-ink"><AlertDialogHeader><AlertDialogTitle>Mulai quiz dari awal?</AlertDialogTitle><AlertDialogDescription>Jawaban sesi ini akan dihapus. Kamu bisa memilih nickname dan jenis kana lagi.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Lanjutkan quiz</AlertDialogCancel><AlertDialogAction onClick={onReset}>Mulai dari awal</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
    <div className="mb-3 flex items-center justify-between font-mono text-xs font-bold"><span>SOAL {String(index + 1).padStart(2, "0")} / 46</span><span className="flex items-center gap-1.5 tabular-nums" aria-label={`Waktu soal ${formatQuizDuration(elapsedMs)}`}><Clock3 className="size-3.5" />{formatQuizDuration(elapsedMs)}</span></div>
    <div role="progressbar" aria-label="Progres quiz" aria-valuemin={0} aria-valuemax={QUIZ_LENGTH} aria-valuenow={session.answers.length} className="mb-5 h-2.5 overflow-hidden rounded-full border-2 border-neo-ink bg-card"><div className="h-full bg-neo-blue" style={{ width: `${session.answers.length / QUIZ_LENGTH * 100}%` }} /></div>
    <div className="relative flex min-h-56 flex-col items-center justify-center rounded-lg border-[3px] border-neo-ink bg-white px-6 py-6 text-neo-ink shadow-neo sm:min-h-72">
      <p className="absolute top-4 left-4 font-mono text-[10px] font-bold tracking-widest uppercase text-slate-500">{session.script}</p>
      <h1 ref={title} tabIndex={-1} className="font-japanese text-[8rem] leading-none font-normal outline-none sm:text-[10rem]" aria-label={`Soal ${index + 1}: ${card.char}`}><span lang="ja">{card.char}</span></h1>
      <p className="mt-3 text-xs font-semibold text-slate-500">Bagaimana cara bacanya?</p>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4" role="group" aria-label="Pilihan romaji">
      {question.options.map((reading, option) => <Button key={`${question.kanaKey}-${reading}`} disabled={pending} onClick={() => onAnswer(question.kanaKey, reading)} className="neo-button relative h-16 border-[3px] border-neo-ink bg-white text-2xl font-extrabold text-neo-ink disabled:opacity-70 sm:h-20 sm:text-3xl"><span className="absolute top-2 left-2.5 font-mono text-[10px] text-slate-500" aria-hidden="true">{option + 1}</span>{reading}</Button>)}
    </div>
    <p role="status" aria-live="polite" className="mt-4 min-h-5 text-center text-xs text-muted-foreground">{pending && session.answers.length ? "Jawaban tersimpan. Soal berikutnya…" : "Pilih satu jawaban. Kamu juga bisa menekan tombol 1–4."}</p>
  </div>;
}

export function KanaQuiz({ initialScript, quizUrl }: { initialScript: KanaScript; quizUrl: string }) {
  const quiz = useKanaQuiz();
  const [defaults, setDefaults] = useState<QuizSetup>({ nickname: "", script: initialScript });

  function retry() {
    if (quiz.session) setDefaults({ nickname: quiz.session.nickname, script: quiz.session.script });
    quiz.reset();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  const active = quiz.session && quiz.session.finishedAt === null;

  return <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
    <nav aria-label="Navigasi quiz" className="mb-6 flex items-center justify-between gap-3">
      <Link href={`/kana/${quiz.session?.script ?? initialScript}`} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold"><ArrowLeft className="size-4" />Kana Lab</Link>
      <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Kenali. Jawab. Kuasai.</span>
    </nav>
    {quiz.storageWarning && <p role="status" className="mx-auto mb-5 max-w-4xl border-2 border-neo-ink bg-neo-yellow px-4 py-3 text-sm text-neo-ink">Penyimpanan tab tidak tersedia. Quiz tetap bisa dimainkan; hindari refresh dan unduh hasil setelah selesai.</p>}
    {quiz.restored && active && <p role="status" className="mx-auto mb-5 max-w-2xl text-xs leading-5 text-muted-foreground">Sesi sebelumnya dipulihkan. Waktu soal tetap berjalan saat refresh.</p>}
    {quiz.session ? (quiz.session.finishedAt !== null ? <QuizResults session={quiz.session} quizUrl={quizUrl} onRetry={retry} /> : <QuizRound session={quiz.session} onAnswer={quiz.answer} onReset={retry} />) : <QuizSetupForm key={`${defaults.nickname}-${defaults.script}`} defaults={defaults} ready={quiz.ready} onStart={(setup) => { quiz.start(setup); window.scrollTo({ top: 0, behavior: "instant" }); }} />}
  </div>;
}
