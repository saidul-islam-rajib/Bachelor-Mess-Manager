import { STRINGS } from '@/lib/strings';

export default function CommentsPage() {
  const strings = STRINGS.pages.comments;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{strings.title}</h1>
            <p className="mt-2 text-slate-600">{strings.description}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">{strings.placeholder}</div>
      </section>
    </main>
  );
}
