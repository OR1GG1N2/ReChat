import React from 'react';
import {
  MessageCircle,
  Mic,
  Heart,
  Monitor,
  Bot,
  Settings,
  Music,
} from 'lucide-react';
import PageHeader from './PageHeader';

const modules = [
  {
    id: 'music',
    label: 'Музыка',
    description: 'Заказ треков YouTube, очередь',
    icon: Music,
    target: 'music',
  },
  {
    id: 'chat',
    label: 'Чат',
    description: '3 канала, ответы, фильтры',
    icon: MessageCircle,
    target: 'appearance',
  },
  {
    id: 'tts',
    label: 'Озвучка TTS',
    description: 'Голос, скорость, фильтры',
    icon: Mic,
    target: 'tts',
  },
  {
    id: 'donations',
    label: 'Донаты и цели',
    description: 'DonationAlerts, шкала сбора',
    icon: Heart,
    target: 'donations',
  },
  {
    id: 'widgets',
    label: 'Виджеты OBS',
    description: 'Все оверлеи стрима',
    icon: Monitor,
    target: 'widgets',
  },
  {
    id: 'filters',
    label: 'Фильтры и боты',
    description: 'Игнор, команды',
    icon: Bot,
    target: 'filters',
  },
  {
    id: 'settings',
    label: 'Настройки',
    description: 'Вид, окно, прокси',
    icon: Settings,
    target: 'appearance',
  },
];

export default function FunctionsTab({
  isWide = true,
  activeTab = 'functions',
  onSelectTab = () => {},
  onSelectModule,
}) {
  const handleClickItem = (item) => {
    if (onSelectModule) {
      onSelectModule(item.label);
    } else {
      onSelectTab(item.target);
    }
  };

  return (
    <div className="flex flex-col w-full font-['Manrope',sans-serif] text-[#EDEEF2] pb-6 select-none">
      <div className={`pt-1 w-full ${isWide ? '' : 'max-w-[500px] mx-auto'}`}>
        {isWide ? (
          <PageHeader
            title="Функции"
            description="Каталог всех доступных модулей и возможностей ReChat"
            badge={{
              text: `${modules.length} модулей`,
              status: 'ok',
            }}
          />
        ) : (
          <div className="pt-2 pb-2.5">
            <div className="text-[18px] font-bold text-[#EDEEF2] leading-tight">
              Функции
            </div>
            <div className="text-xs text-[#A0A4B4] mt-0.5">
              Все модули ReChat
            </div>
          </div>
        )}

        {/* Modules List matching requirements */}
        <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#15171E]">
          {modules.map((module, index) => {
            const Icon = module.icon;

            return (
              <button
                key={module.id}
                type="button"
                onClick={() => handleClickItem(module)}
                className={`flex w-full items-center gap-[10px] p-[10px_12px] text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05] cursor-pointer ${
                  index !== modules.length - 1
                    ? 'border-b border-white/[0.06]'
                    : ''
                }`}
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[#1E212B]">
                  <Icon className="h-4 w-4 text-[#A0A4B4]" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold leading-tight text-[#EDEEF2] truncate">
                    {module.label}
                  </span>
                  <span className="block text-xs text-[#A0A4B4] mt-0.5 truncate">
                    {module.description}
                  </span>
                </span>

                <span className="text-base text-[#6B7080] font-sans px-1 select-none">
                  ›
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
