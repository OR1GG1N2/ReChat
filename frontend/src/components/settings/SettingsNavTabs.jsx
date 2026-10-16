import React from 'react';

function ConnectionsIcon({ className = 'w-[22px] h-[22px]' }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="12" r="3" />
      <path d="M9 12h6" />
    </svg>
  );
}

function HomeIcon({ className = 'w-[22px] h-[22px]' }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function FunctionsIcon({ className = 'w-[22px] h-[22px]' }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

const navigation = [
  { id: 'connections', label: 'Подключения', icon: ConnectionsIcon },
  { id: 'home', label: 'Главная', icon: HomeIcon },
  { id: 'functions', label: 'Функции', icon: FunctionsIcon },
];

export default function SettingsNavTabs({ activeTab, onSelectTab }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-30 flex h-[62px] shrink-0 items-center border-t border-white/[0.06] bg-[#12141A] font-['Manrope',sans-serif]">
      {navigation.map((item) => {
        const Icon = item.icon;
        const selected = activeTab === item.id;
        const isHome = item.id === 'home';

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`flex h-full flex-1 flex-col items-center text-[11px] font-bold transition-colors cursor-pointer select-none ${
              isHome ? 'justify-start' : 'justify-center gap-[3px]'
            } ${selected ? 'text-[#7CF2C8]' : 'text-[#6B7080] hover:text-[#A0A4B4]'}`}
          >
            {isHome ? (
              <span
                className={`-mt-[26px] mb-0 grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-[5px] border-[#0E0F13] shadow-md transition-all ${
                  selected
                    ? 'bg-[#7CF2C8] text-[#0E0F13]'
                    : 'bg-[#1E212B] text-[#A0A4B4] hover:bg-[#282C38]'
                }`}
              >
                <Icon className="h-[22px] w-[22px]" />
              </span>
            ) : (
              <Icon className="h-[22px] w-[22px]" />
            )}

            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
