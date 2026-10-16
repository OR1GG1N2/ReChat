import {
  Home,
  Music,
  Network,
  Layers,
  Sliders,
  Radio,
  Coins,
  Volume2,
  Filter,
  LayoutDashboard,
  Globe,
} from 'lucide-react';

export const FONT_OPTIONS = [
  { id: 'Lato', label: 'Lato (Стандартный)' },
  { id: 'Inter', label: 'Inter (Современный)' },
  { id: 'Geist', label: 'Geist (Vercel)' },
  { id: 'Roboto', label: 'Roboto (Google)' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono (Код)' },
];

export const SPACING_OPTIONS = [
  { id: 'compact', label: 'Компактные строки' },
  { id: 'default', label: 'Стандартный отступ' },
  { id: 'relaxed', label: 'Свободный (Увеличенный)' },
];

export const ALIGN_OPTIONS = [
  { id: 'left', label: 'По левому краю' },
  { id: 'center', label: 'По центру' },
  { id: 'right', label: 'По правому краю' },
];

export const SIDEBAR_TABS = [
  // Главные разделы
  { id: 'home', label: 'Главная', desc: 'Стрим, события и хоткеи', icon: Home, group: 'main' },
  { id: 'music', label: 'Музыка', desc: 'YouTube плеер и очередь', icon: Music, group: 'main' },
  { id: 'connections', label: 'Подключения', desc: 'Twitch, Kick, DA, OBS', icon: Network, group: 'main' },
  { id: 'functions', label: 'Функции', desc: 'Каталог всех модулей', icon: Layers, group: 'main' },

  // Модули и параметры
  { id: 'appearance', label: 'Внешний вид', desc: 'Шрифты, размеры и значки', icon: Sliders, group: 'settings' },
  { id: 'channels', label: 'Каналы', desc: 'Twitch и Kick мультичат', icon: Radio, group: 'settings' },
  { id: 'donations', label: 'Донаты (DA)', desc: 'DonationAlerts и сборы', icon: Coins, group: 'settings' },
  { id: 'tts', label: 'Озвучка (TTS)', desc: 'Алиса и синтез речи', icon: Volume2, group: 'settings' },
  { id: 'widgets', label: 'Виджеты OBS', desc: 'Все оверлеи стрима', icon: LayoutDashboard, group: 'settings' },
  { id: 'filters', label: 'Фильтры', desc: 'Боты и команды', icon: Filter, group: 'settings' },
  { id: 'proxy', label: 'Прокси и Сеть', desc: 'HTTP, SOCKS5, WireGuard', icon: Globe, group: 'settings' },
];

export const getScalingLabel = (size) => {
  if (size <= 12) return 'Компактный';
  if (size === 14) return 'Стандартный';
  if (size === 16) return 'Средний';
  if (size === 18) return 'Крупный';
  return 'Очень крупный';
};
