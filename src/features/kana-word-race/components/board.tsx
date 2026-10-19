"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Delete, Keyboard, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Feedback, RaceSnapshot } from "../contracts";
import { composeRomaji, isGameKana, KEYBOARD_ROWS, modifyKana } from "../domain/kana";

const LABEL = { correct: "tepat posisi", present: "ada di posisi lain", absent: "tidak ada" };
export function RaceBoard({ match, enabled, pending, submissionError, onGuess }: { match: NonNullable<RaceSnapshot["match"]>; enabled: boolean; pending: boolean; submissionError?: string | null; onGuess: (kana: string) => void }) {
  const [editor, setEditor] = useState({ count: match.guesses.length, raw: "", error: "" });
  const [textMode, setTextMode] = useState(false);
  const raw = editor.count === match.guesses.length ? editor.raw : "";
  const error = editor.count === match.guesses.length ? editor.error : "";
  const setRaw = (value: string) => setEditor({ count: match.guesses.length, raw: value, error: "" });
  const setError = (value: string) => setEditor((previous) => ({ count: match.guesses.length, raw: previous.count === match.guesses.length ? previous.raw : "", error: value }));
  const composing = useRef(false); const input = useRef<HTMLInputElement>(null);
  const focusRequested = useRef(false);
  const focusEditor = () => input.current?.focus({ preventScroll: true });
  useLayoutEffect(() => {
    if (focusRequested.current) { input.current?.focus({ preventScroll: true }); focusRequested.current = false; }
  }, [textMode]);
  const draft = composeRomaji(raw); const guesses = match.guesses;
  const showKeyboard = !textMode && match.status === "PLAYING";
  const notice = error || submissionError;
  const scores = new Map<string, Feedback>(); const strengths = { absent: 1, present: 2, correct: 3 };
  guesses.forEach((guess) => Array.from(guess.kana).forEach((char, i) => { const mark = guess.feedback[i]!; if (strengths[mark] > (scores.has(char) ? strengths[scores.get(char)!] : 0)) scores.set(char, mark); }));
  function change(next: string) {
    const value = composeRomaji(next);
    if (value.kana.length <= match.length && value.pending.length <= 4) { setRaw(value.raw); setError(""); }
    else { setRaw(value.kana.slice(0, match.length)); setError(`Maksimal ${match.length} karakter kana.`); }
  }
  function erase() { change(draft.pending ? raw.slice(0, -1) : Array.from(draft.kana).slice(0, -1).join("")); }
  function submit() {
    if (!enabled || pending || composing.current) return;
    focusEditor();
    if (draft.pending || draft.kana.length !== match.length || !isGameKana(draft.kana)) { setError(`Lengkapi ${match.length} kotak kana terlebih dahulu.`); return; }
    onGuess(draft.kana);
  }
  return <section className="race-board-wrap" data-keyboard={showKeyboard} aria-label="Papan tebakan pribadi">
    <div className="race-board-pane">
    <div className="race-composer">
      <div className="race-composer-heading">
        <label htmlFor="race-editor" className="text-xs font-extrabold">{textMode ? "Romaji atau kana" : `Tebakan ${Math.min(guesses.length + 1, 6)}/6`}</label>
        <button className="race-input-toggle" type="button" aria-pressed={textMode} onClick={() => { focusRequested.current = true; setTextMode(!textMode); }}><Keyboard className="size-4" />{textMode ? "Keyboard kana" : "Ketik romaji"}</button>
      </div>
      <div className="race-submit-row">
        <Input id="race-editor" ref={input} value={raw} disabled={!enabled} readOnly={pending} inputMode={textMode ? "text" : "none"} className={textMode ? "race-input" : "race-hidden-editor"} aria-label="Input tebakan. Romaji otomatis menjadi hiragana." aria-describedby="race-editor-status" aria-invalid={Boolean(notice)} aria-errormessage={notice ? "race-editor-error" : undefined} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          onChange={(event) => composing.current ? setRaw(event.target.value) : change(event.target.value)}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={(event) => { composing.current = false; change(event.currentTarget.value); }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229 || pending) return;
            if (event.key === "Enter") { event.preventDefault(); submit(); }
            if (event.key === "Backspace") { event.preventDefault(); erase(); }
          }} />
        {!textMode && <span className="race-draft-preview" lang="ja" aria-label={`Draft tebakan: ${draft.kana || "kosong"}`}>{draft.kana || "—"}<span className="text-xs font-medium">{draft.pending}</span></span>}
        <button type="button" className="race-key race-erase" aria-label="Hapus karakter terakhir" disabled={!enabled || pending} onMouseDown={(event) => event.preventDefault()} onClick={erase}><Delete className="size-5" /></button>
        <Button className="race-button race-submit" type="button" disabled={!enabled || pending} onMouseDown={(event) => event.preventDefault()} onClick={submit}>Tebak<Send className="size-4" /></Button>
      </div>
      <p id="race-editor-status" className="race-editor-status" aria-live="polite">{pending ? "Mengirim tebakan..." : draft.pending ? `Menunggu lanjutan: ${draft.pending}` : textMode ? `${guesses.length}/6 tebakan · Enter untuk menebak` : `${draft.kana.length}/${match.length} kana · Klik kotak untuk mengetik`}</p>
      {notice && <p id="race-editor-error" role="alert" className="race-editor-error">{notice}</p>}
    </div>
    <div className="race-board" style={{ "--race-columns": match.length } as CSSProperties} onClick={focusEditor}>
      {Array.from({ length: 6 }, (_, row) => {
        const guess = guesses[row]; const active = row === guesses.length && match.status === "PLAYING";
        const chars = Array.from(guess?.kana ?? (active ? draft.kana : ""));
        return <div className="race-board-row" key={row} aria-label={`Tebakan ${row + 1}${guess ? `: ${guess.kana}` : ""}`}>
          {Array.from({ length: match.length }, (_, column) => <span key={column} className="race-tile" data-mark={guess?.feedback[column]} data-filled={Boolean(chars[column])} data-active={active && column === chars.length} lang="ja" aria-label={`Posisi ${column + 1}: ${chars[column] ?? "kosong"}${guess ? `, ${LABEL[guess.feedback[column]!]}` : ""}`}>{chars[column]}</span>)}
        </div>;
      })}
    </div>
    <div className="race-board-legend"><span className="race-legend" data-mark="correct">Tepat posisi</span><span className="race-legend" data-mark="present">Posisi lain</span><span className="race-legend" data-mark="absent">Tidak ada</span></div>
    </div>
    {showKeyboard && <div className="race-keyboard" aria-label="Keyboard hiragana">
      <p className="text-xs font-extrabold">Pilih kana</p>
      {KEYBOARD_ROWS.map((row) => <div className="race-key-row" key={row}>{Array.from(row).map((char) => <button key={char} type="button" className="race-key" data-mark={scores.get(char)} aria-label={`${char}${scores.has(char) ? `, ${LABEL[scores.get(char)!]}` : ""}`} disabled={!enabled || pending} onMouseDown={(event) => event.preventDefault()} onClick={() => { change(draft.kana + char); focusEditor(); }} lang="ja">{char}</button>)}</div>)}
      <div className="race-key-actions">
        <button type="button" className="race-key" disabled={!enabled || pending} onMouseDown={(event) => event.preventDefault()} onClick={() => { const chars = Array.from(draft.kana); if (chars.length) chars[chars.length - 1] = modifyKana(chars[chars.length - 1]!, "small"); change(chars.join("")); }}>小<span className="ml-1 text-xs">Huruf kecil</span></button>
        <button type="button" className="race-key" aria-label="Dakuten dan handakuten" disabled={!enabled || pending} onMouseDown={(event) => event.preventDefault()} onClick={() => { const chars = Array.from(draft.kana); if (chars.length) chars[chars.length - 1] = modifyKana(chars[chars.length - 1]!, "voice"); change(chars.join("")); }}>゛゜<span className="ml-1 text-xs">Dakuten</span></button>
      </div>
    </div>}
  </section>;
}
