import React from 'react';

export default function FiltersTab({
  isWide,
  formData,
  updateAndSave,
  newIgnoredUser,
  setNewIgnoredUser,
  handleAddIgnoredUser,
  handleRemoveIgnoredUser,
}) {
  return (
    <div className={`space-y-4 ${isWide ? 'grid grid-cols-1 gap-4' : 'max-w-lg mx-auto'}`}>
      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Фильтры чата (Chat Filters)
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 space-y-4 border border-white/[0.03] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Игнорировать команды бота (!, /, ., $, ?)
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={formData.ignoreCommands}
              onClick={() =>
                updateAndSave({ ignoreCommands: !formData.ignoreCommands })
              }
              className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none ${
                formData.ignoreCommands ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
              }`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                  formData.ignoreCommands ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="h-px bg-white/[0.06]" />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#ECECF1]">
              Скрывать игнорируемые из чата
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={formData.hideIgnoredFromChat}
              onClick={() =>
                updateAndSave({
                  hideIgnoredFromChat: !formData.hideIgnoredFromChat,
                })
              }
              className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 cursor-pointer focus:outline-none ${
                formData.hideIgnoredFromChat ? 'bg-[#3B82F6]' : 'bg-[#383A48]'
              }`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                  formData.hideIgnoredFromChat ? 'translate-x-5.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-[#8E92A4] px-1 mb-1.5">
          Игнорируемые пользователи и боты
        </div>
        <div className="bg-[#242631] rounded-2xl p-4 border border-white/[0.03] shadow-sm space-y-3">
          <form onSubmit={handleAddIgnoredUser} className="flex gap-2">
            <input
              type="text"
              value={newIgnoredUser}
              onChange={(e) => setNewIgnoredUser(e.target.value)}
              placeholder="Имя пользователя (напр. Nightbot)"
              className="flex-1 bg-[#181920] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-[#ECECF1] placeholder:text-[#6C7082] outline-none focus:border-[#3B82F6]"
            />
            <button
              type="submit"
              disabled={!newIgnoredUser.trim()}
              className="px-3.5 py-2 bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-50 text-[#ECECF1] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Добавить
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {(formData.ignoredUsers || []).map((u) => (
              <span
                key={u}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#181920] border border-white/[0.06] text-xs font-medium text-[#ECECF1]"
              >
                <span>@{u}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveIgnoredUser(u)}
                  className="text-[#8E92A4] hover:text-rose-400 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
