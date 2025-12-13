const Sidebar = ({ tags, selectedTag, onSelectTag }) => (
  <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white/60 p-4 backdrop-blur">
    <div className="mb-6 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Library
        </p>
        {/* <h1 className="text-xl font-bold text-slate-900">
          Pickleball Media
        </h1> */}
      </div>
      {/* <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        All
      </span> */}
    </div>
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          Views
        </p>
        <button
          onClick={() => onSelectTag("all")}
          className={`mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
            selectedTag === "all"
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span>All Media</span>
        </button>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          Categories
        </p>
        <div className="mt-2 space-y-2">
          {tags.length === 0 && (
            <p className="text-xs text-slate-400">No tags yet.</p>
          )}
          {tags.map((tag) => (
            <button
              key={tag.name}
              onClick={() => onSelectTag(tag.name)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${
                selectedTag === tag.name
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="capitalize">{tag.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  </aside>
);

export default Sidebar;