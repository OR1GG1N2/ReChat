import React from 'react';
import CustomTitleBar from './CustomTitleBar';
import SettingsSidebar from './settings/SettingsSidebar';
import SettingsNavTabs from './settings/SettingsNavTabs';
import SettingsContent from './settings/SettingsContent';
import {
  SIDEBAR_TABS,
  FONT_OPTIONS,
  SPACING_OPTIONS,
  ALIGN_OPTIONS,
  getScalingLabel,
} from './settings/settingsConstants';
import { useSettingsViewLogic } from './settings/useSettingsViewLogic';

const TAB_TITLES = {
  home: 'Главная',
  connections: 'Подключения',
  account: 'Подключения',
  functions: 'Функции',
  FunctionsTab: 'Функции',
  music: 'Музыка',
};

export default function SettingsView({ onClose }) {
  const logic = useSettingsViewLogic(onClose);
  const {
    activeTab,
    setActiveTab,
    setActiveWidgetSubTab,
    isWide,
    statusMsg,
  } = logic;

  const currentTabObj = SIDEBAR_TABS.find((t) => t.id === activeTab);
  const currentTitle = TAB_TITLES[activeTab] || currentTabObj?.label || 'Параметры';
  const isTopNavTab = ['home', 'connections', 'functions'].includes(activeTab);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'widgets') {
      setActiveWidgetSubTab('catalog');
    }
  };

  const handleBack = () => {
    if (!isTopNavTab) {
      setActiveTab('functions');
    } else {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0E0F13] text-[#EDEEF2] select-none font-sans overflow-hidden">
      <CustomTitleBar
        isSettingsMode={true}
        settingsTitle={currentTitle}
        onBack={handleBack}
        onCloseSettings={onClose}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* WIDE DESKTOP MODE (Sidebar Navigation) */}
        {isWide && (
          <SettingsSidebar
            tabs={SIDEBAR_TABS}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            statusMsg={statusMsg}
            onClose={onClose}
            twitchAuthStatus={logic.twitchAuthStatus}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <section
            className={`flex-1 ${
              activeTab === 'music'
                ? 'overflow-hidden flex flex-col p-0'
                : `overflow-y-auto ${isWide ? 'p-4 md:p-6' : 'p-3 pb-[74px]'} custom-scrollbar`
            } bg-[#0E0F13]`}
          >
            <div className={activeTab === 'music' ? 'w-full h-full flex flex-col flex-1 min-h-0' : 'w-full'}>
              <SettingsContent
                {...logic}
                FONT_OPTIONS={FONT_OPTIONS}
                SPACING_OPTIONS={SPACING_OPTIONS}
                ALIGN_OPTIONS={ALIGN_OPTIONS}
                getScalingLabel={getScalingLabel}
              />
            </div>

            {!isWide && statusMsg && (
              <div className="text-[11px] text-center text-[#7CF2C8] font-medium py-2">
                {statusMsg}
              </div>
            )}
          </section>

          {/* COMPACT STREAM COMPANION MODE (Bottom bar navigation) */}
          {!isWide && (
            <SettingsNavTabs
              tabs={SIDEBAR_TABS}
              activeTab={activeTab === 'account' ? 'connections' : activeTab}
              onSelectTab={handleSelectTab}
            />
          )}
        </div>
      </div>
    </div>
  );
}
