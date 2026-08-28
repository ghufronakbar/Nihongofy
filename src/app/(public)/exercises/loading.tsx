export default function ExercisesLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl animate-pulse space-y-8" aria-label="Memuat latihan cepat">
      <div className="h-72 border-[3px] border-neo-ink bg-white shadow-neo" />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="h-52 border-[3px] border-neo-ink bg-white shadow-neo" />
        <div className="h-52 border-[3px] border-neo-ink bg-white shadow-neo" />
      </div>
    </div>
  );
}
