export default function Admin() {
  return (
    <div>
      <header className="flex items-center justify-between gap-6 mb-[26px] flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[13px] bg-white text-navy font-extrabold flex items-center justify-center text-[17px]">
            FC
          </div>
          <div>
            <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-faint text-sm">Enter results &amp; settle fixtures</p>
          </div>
        </div>
      </header>

      <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[620px]">
        <p className="text-[15px] font-semibold m-0 mb-2">Settle a fixture</p>
        <p className="text-[13px] text-muted m-0 mb-3.5 leading-normal">
          One-click result entry and settlement lands here next. For now, settle
          through the API as admin:
        </p>
        <pre className="m-0 bg-[#07101d] border border-white/10 rounded-[10px] p-3.5 font-mono text-[12.5px] text-ink whitespace-pre-wrap break-words">POST /api/fixtures/&lt;id&gt;/settle
{'{ "home_score": 2, "away_score": 1 }'}</pre>
      </section>
    </div>
  );
}
