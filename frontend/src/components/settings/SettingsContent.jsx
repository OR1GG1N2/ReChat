import React from 'react';
import HomeTab from './HomeTab';
import AppearanceTab from './AppearanceTab';
import ChannelsTab from './ChannelsTab';
import AccountTab from './AccountTab';
import DonationsTab from './DonationsTab';
import TTSTab from './TTSTab';
import FiltersTab from './FiltersTab';
import ProxyTab from './ProxyTab';
import WidgetsTab from './WidgetsTab';
import FunctionsTab from './FunctionsTab';
import MusicTab from './MusicTab';

export default function SettingsContent({
  activeTab,
  isWide,
  onClose,
  // Appearance
  formData,
  updateAndSave,
  FONT_OPTIONS,
  SPACING_OPTIONS,
  ALIGN_OPTIONS,
  getScalingLabel,
  handleFontSizeChange,
  handleToggleAlwaysOnTop,
  handleSendTestFollow,
  isTestingFollow,
  // Channels
  channelInput,
  setChannelInput,
  handleAddChannel,
  joinedChannels,
  handleRemoveChannel,
  kickChannelInput,
  setKickChannelInput,
  handleAddKickChannel,
  joinedKickChannels,
  handleRemoveKickChannel,
  // Account & DA
  handleAuth,
  handleLogout,
  isAuthenticating,
  twitchAuthStatus,
  daTestResult,
  showDAToken,
  setShowDAToken,
  handleTestDA,
  isTestingDA,
  handleSendTestDonation,
  isTestingDonation,
  handleSendTestGoal,
  isTestingGoal,
  setActiveTab,
  // TTS
  localVoices,
  audioDevices,
  isTTSTesting,
  handleTestTTS,
  // Filters
  newIgnoredUser,
  setNewIgnoredUser,
  handleAddIgnoredUser,
  handleRemoveIgnoredUser,
  // Widgets
  activeWidgetSubTab,
  setActiveWidgetSubTab,
  // Proxy
  wgTunnelActive,
  wgImportResult,
  handleImportWireGuard,
  isImportingWg,
  showProxyPassword,
  setShowProxyPassword,
  handleTestProxy,
  isTestingProxy,
  proxyTestResult,
}) {
  const renderTab = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeTab
            onSelectTab={setActiveTab}
            onClose={onClose}
            joinedChannels={joinedChannels}
          />
        );

    case 'appearance':
      return (
        <AppearanceTab
          isWide={isWide}
          formData={formData}
          updateAndSave={updateAndSave}
          FONT_OPTIONS={FONT_OPTIONS}
          SPACING_OPTIONS={SPACING_OPTIONS}
          ALIGN_OPTIONS={ALIGN_OPTIONS}
          getScalingLabel={getScalingLabel}
          handleFontSizeChange={handleFontSizeChange}
          handleToggleAlwaysOnTop={handleToggleAlwaysOnTop}
          handleSendTestFollow={handleSendTestFollow}
          isTestingFollow={isTestingFollow}
        />
      );

    case 'channels':
      return (
        <ChannelsTab
          isWide={isWide}
          channelInput={channelInput}
          setChannelInput={setChannelInput}
          handleAddChannel={handleAddChannel}
          joinedChannels={joinedChannels}
          handleRemoveChannel={handleRemoveChannel}
          kickChannelInput={kickChannelInput}
          setKickChannelInput={setKickChannelInput}
          handleAddKickChannel={handleAddKickChannel}
          joinedKickChannels={joinedKickChannels}
          handleRemoveKickChannel={handleRemoveKickChannel}
        />
      );

    case 'connections':
    case 'account':
      return (
        <AccountTab
          isWide={isWide}
          formData={formData}
          updateAndSave={updateAndSave}
          handleAuth={handleAuth}
          handleLogout={handleLogout}
          isAuthenticating={isAuthenticating}
          twitchAuthStatus={twitchAuthStatus}
          daTestResult={daTestResult}
          showDAToken={showDAToken}
          setShowDAToken={setShowDAToken}
          handleTestDA={handleTestDA}
          isTestingDA={isTestingDA}
          handleSendTestDonation={handleSendTestDonation}
          isTestingDonation={isTestingDonation}
          handleSendTestGoal={handleSendTestGoal}
          isTestingGoal={isTestingGoal}
          joinedChannels={joinedChannels}
          joinedKickChannels={joinedKickChannels}
          handleAddKickChannel={handleAddKickChannel}
          handleRemoveKickChannel={handleRemoveKickChannel}
        />
      );

    case 'donations':
      return (
        <DonationsTab
          formData={formData}
          updateAndSave={updateAndSave}
          daTestResult={daTestResult}
          handleSendTestDonation={handleSendTestDonation}
          isTestingDonation={isTestingDonation}
          handleSendTestGoal={handleSendTestGoal}
          isTestingGoal={isTestingGoal}
          setActiveTab={setActiveTab}
        />
      );

    case 'tts':
      return (
        <TTSTab
          isWide={isWide}
          isDesktop={isWide}
          formData={formData}
          updateAndSave={updateAndSave}
          localVoices={localVoices}
          audioDevices={audioDevices}
          isTTSTesting={isTTSTesting}
          handleTestTTS={handleTestTTS}
        />
      );

    case 'filters':
      return (
        <FiltersTab
          isWide={isWide}
          formData={formData}
          updateAndSave={updateAndSave}
          newIgnoredUser={newIgnoredUser}
          setNewIgnoredUser={setNewIgnoredUser}
          handleAddIgnoredUser={handleAddIgnoredUser}
          handleRemoveIgnoredUser={handleRemoveIgnoredUser}
        />
      );

    case 'widgets':
      return (
        <WidgetsTab
          formData={formData}
          updateAndSave={updateAndSave}
          activeSubTab={activeWidgetSubTab}
          setActiveSubTab={setActiveWidgetSubTab}
        />
      );

    case 'proxy':
      return (
        <ProxyTab
          formData={formData}
          updateAndSave={updateAndSave}
          wgTunnelActive={wgTunnelActive}
          wgImportResult={wgImportResult}
          handleImportWireGuard={handleImportWireGuard}
          isImportingWg={isImportingWg}
          showProxyPassword={showProxyPassword}
          setShowProxyPassword={setShowProxyPassword}
          handleTestProxy={handleTestProxy}
          isTestingProxy={isTestingProxy}
          proxyTestResult={proxyTestResult}
        />
      );

      case 'music':
      default:
        return null;
    }
  };

  return (
    <>
      {/* Permanent MusicTab instance so YouTube player never unmounts across tab or mode changes */}
      <div
        className={activeTab === 'music' ? 'w-full h-full flex flex-col flex-1 min-h-0' : ''}
        style={
          activeTab === 'music'
            ? { display: 'flex', flexDirection: 'column', height: '100%', flex: 1, minHeight: 0 }
            : {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '1px',
                height: '1px',
                overflow: 'hidden',
                opacity: 0,
                pointerEvents: 'none',
                zIndex: -10,
              }
        }
      >
        <MusicTab isWide={isWide} />
      </div>

      {activeTab !== 'music' && (
        <div className="w-full">
          {renderTab()}
        </div>
      )}
    </>
  );
}
