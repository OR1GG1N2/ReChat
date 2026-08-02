// ReChat Frontend Controller (Wails Standalone Windows)

function openChatWindow() {
  if (window.go && window.go.main && window.go.main.App && window.go.main.App.OpenChatWindow) {
    window.go.main.App.OpenChatWindow();
  } else {
    window.location.href = 'index.html';
  }
}

function openSettingsWindow() {
  if (window.go && window.go.main && window.go.main.App && window.go.main.App.OpenSettingsWindow) {
    window.go.main.App.OpenSettingsWindow();
  } else {
    window.location.href = 'settings.html';
  }
}

function getFeedContainer() {
  return document.getElementById('chat-feed') || document.getElementById('onlychat-feed');
}

const SVG_BADGES = {
  shield: `<svg class="box-border w-[11px] shrink-0 h-[11px] text-[#06B6D4]" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.84619 0.60156q-0.34863 0.02734-0.68701 0.30762-0.51611 0.42041-1.00147 0.70068-0.48193 0.28027-1.01513 0.4751-0.30762 0.11279-0.58789 0.1709-0.28027 0.05469-0.66992 0.08203-0.23926 0.01367-0.36573 0.07178-0.19482 0.06836-0.37939 0.22217-0.18115 0.15381-0.26319 0.34863l-0.01367 0.03076q-0.07178 0.12646-0.08545 0.22217-0.01367 0.15381-0.02734 0.60156l0 1.78076q0 2.25244 0.01367 2.46094 0.14014 1.6543 1.10742 2.88477 0.14014 0.16748 0.43409 0.46142 0.29395 0.29394 0.48877 0.44775 0.92285 0.7417 2.2832 1.27491 0.46143 0.18115 0.65625 0.23926 0.23926 0.05469 0.43408 0.01367 0.16748-0.02734 0.5332-0.15381 1.35693-0.51953 2.27979-1.20313 0.37939-0.2666 0.71435-0.60498 1.37402-1.3706 1.54151-3.37353 0.01367-0.23584 0.01367-2.46094 0-2.22852-0.02734-2.35498-0.07178-0.32129-0.31787-0.56396-0.24268-0.24609-0.5503-0.31788-0.09912-0.02734-0.37939-0.04101-0.48877-0.02734-0.96387-0.18115-0.81348-0.2666-1.55518-0.77246-0.2666-0.18115-0.64257-0.48877-0.42041-0.33496-0.96729-0.28028z m0.43408 1.34326q0.64258 0.51953 1.32959 0.86817 1.2168 0.61865 2.25244 0.68701l0.21192 0-0.01367 4.31348q0 0.33496-0.02735 0.50244-0.22559 1.34326-1.1416 2.27637-0.91602 0.92969-2.66601 1.57226l-0.21192 0.08545-0.18115-0.05469q-2.32422-0.85449-3.2334-2.22851-0.47852-0.71436-0.63232-1.63721-0.02734-0.18115-0.02735-0.50244l-0.01367-4.32715 0.19483 0q0.86816-0.05469 1.84912-0.48193 0.98096-0.42725 1.83545-1.12793 0.16748-0.14014 0.19482-0.14014 0.02734 0 0.28027 0.19482z"/></svg>`,
  crown: `<svg class="box-border w-[11px] shrink-0 h-[11px] text-[#FACC15]" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.77441 1.20313q-0.3623 0.09912-0.58789 0.49218l-1.67822 3.20606-2.4917-2.14307q-0.21191-0.16748-0.49902-0.18799-0.28711-0.02393-0.5127 0.11621-0.22217 0.14014-0.34179 0.38623-0.11621 0.24609-0.06153 0.48194 0.01367 0.11279 0.85449 3.14453 0.84082 3.03174 0.89551 3.17187 0.08545 0.15381 0.2461 0.30762 0.16064 0.15381 0.32812 0.22217l0.02735 0.01367q0.11279 0.04443 0.25292 0.05811 0.22559 0.02734 0.92286 0.02734l6.10449-0.01367q0.61524 0 0.67334-0.02735 0.60156-0.18457 0.79639-0.74169 0.04443-0.11279 0.86816-3.09327 0.82715-2.98389 0.84082-3.083 0.02734-0.16748-0.03076-0.34864-0.05469-0.18115-0.17774-0.32129-0.18457-0.22559-0.47168-0.28711-0.28711-0.06494-0.55029 0.06153l-0.03076 0.01367q-0.06836 0.02734-0.22217 0.15381l-1.22021 1.03564q-1.20312 1.03906-1.22364 1.02539-0.02051-0.01709-0.86132-1.62011-0.84082-1.60303-0.89551-1.67139-0.14014-0.23926-0.41358-0.3418-0.27344-0.10596-0.54004-0.0376z m0.93995 2.8164q0.68701 1.29883 0.75537 1.43213 0.07178 0.1333 0.20849 0.2666 0.14014 0.1333 0.25293 0.20508 0.29395 0.15381 0.62891 0.1333 0.33838-0.02393 0.59131-0.20508 0.0957-0.05469 0.93652-0.79638l0.88184-0.7417q0.02734-0.01709 0.02734-0.01709l-1.38428 5.02783-7.22558 0-1.37061-5.01074q-0.01367-0.01709 0.01367 0l0.88184 0.7417q0.84082 0.7417 0.93652 0.79638 0.28027 0.21191 0.67334 0.21192 0.25293 0 0.51953-0.12647 0.14014-0.07178 0.27002-0.20508 0.1333-0.1333 0.21875-0.25634l0.75537-1.45606q0.70068-1.33301 0.71436-1.33301 0.01367 0 0.71436 1.33301z m-4.9834 7.6836q-0.23926 0.08545-0.34522 0.3247-0.10254 0.23584-0.00683 0.46143 0.05811 0.0957 0.14013 0.18115 0.08545 0.08203 0.18457 0.12647l0.09571 0.02734 8.40136 0 0.09571-0.02734q0.09912-0.04443 0.18115-0.12647 0.08545-0.08545 0.1333-0.18799 0.05127-0.10596 0.05127-0.23242 0-0.12646-0.04102-0.23926-0.09912-0.19482-0.29394-0.29394l-0.08545-0.04102-4.22803 0q-4.22803 0-4.28271 0.02735z"/></svg>`,
  heart: `<svg class="box-border w-[11px] shrink-0 h-[11px] text-[#EC4899]" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9.37891 1.75q-0.64258 0.04102-1.24414 0.30078-0.60156 0.25977-1.04932 0.68018l-0.08545 0.06836-0.11279-0.09571q-0.40674-0.35205-0.88184-0.57422-0.51611-0.25293-1.13476-0.35205-0.16748-0.02734-0.51954-0.0205-0.34863 0.00684-0.52978 0.03418-1.24414 0.19824-2.11231 1.0664-1.0083 1.0083-1.10742 2.41992-0.08203 0.98096 0.39307 1.94825 0.19482 0.37598 0.44092 0.72119 0.24609 0.3418 0.67675 0.80322 0.21191 0.23926 1.97559 1.94824 1.76367 1.70557 1.87647 1.79102 0.44775 0.33496 1.03564 0.33496 0.58789 0 1.03564-0.33496 0.11279-0.08545 1.88331-1.80811 1.77051-1.72266 1.98242-1.93115 0.41699-0.46143 0.66308-0.80322 0.24609-0.34521 0.44092-0.72119 0.35205-0.70068 0.3999-1.43555 0.04785-0.73486-0.18798-1.46289-0.19824-0.61865-0.61866-1.14844-0.41699-0.5332-0.97754-0.86816-0.49219-0.30762-1.08691-0.45459-0.59473-0.14697-1.15527-0.10596z"/></svg>`,
  tts: `<svg class="box-border w-[11px] shrink-0 h-[11px] text-[#A855F7]" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" onclick="testTTS()"><path d="M5.85156 1.76367q-0.16748 0.02734-0.30761 0.11279-0.08545 0.04102-0.27344 0.21875-0.18799 0.17432-0.91602 0.90235-1.08008 1.06299-1.12109 1.06982-0.04102 0.00684-0.85449 0.02051-0.66992 0-0.82373 0.01367-0.15381 0.01367-0.30762 0.09912-0.23926 0.11279-0.3999 0.30762-0.16064 0.19482-0.23243 0.44775-0.01367 0.08545-0.02734 0.3794l0 1.66455 0 1.66455q0.01367 0.29395 0.02734 0.3794 0.08545 0.30762 0.30762 0.52636 0.22559 0.21533 0.51953 0.31446 0.06836 0.01367 0.22217 0.02734l0.70068 0q0.82715 0.01367 0.86817 0.02051 0.04102 0.00684 1.09717 1.05957 1.05957 1.04932 1.12793 1.09033 0.22559 0.15381 0.48535 0.16748 0.25977 0.01367 0.50927-0.11279 0.11279-0.05469 0.2461-0.18116 0.1333-0.12646 0.18799-0.25292l0.02734-0.04102q0.04443-0.08545 0.05811-0.25293 0.01367-0.2085 0.02734-0.97754l0-7.07178q-0.01367-0.76904-0.02734-0.84082-0.08545-0.33496-0.35889-0.55029-0.27344-0.21875-0.6084-0.21875-0.11279 0-0.15381 0.01367z"/></svg>`,
  bot: `<svg class="box-border w-[11px] shrink-0 h-[11px] text-[#6E6E7A]" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.52197 1.76367q-0.14014 0.04102-0.2666 0.16748-0.16748 0.15381-0.17432 0.37256-0.00684 0.21533 0.12647 0.38623 0.1333 0.16748 0.35547 0.22217 0.09912 0.01367 0.98096 0.01367l0.88183 0 0 1.14844-1.42871 0q-1.104 0-1.44922 0.01367-0.3418 0.01367-0.4956 0.05469-0.43408 0.12646-0.74854 0.42041-0.31445 0.29395-0.45459 0.71435-0.07178 0.19824-0.08545 0.39991-0.01367 0.20166-0.01367 0.96045l0 0.93652-0.34863 0q-0.2666 0.01367-0.33155 0.02051-0.06152 0.00684-0.1333 0.04785-0.23584 0.09912-0.32129 0.33838-0.08203 0.23584 0.02735 0.46142 0.04443 0.06836 0.11963 0.14014 0.07861 0.06836 0.15381 0.10596 0.07861 0.03418 0.14013 0.04101 0.06494 0.00684 0.33155 0.02051l0.3623 0 0 1.79102q0.01367 0.16748 0.02734 0.29394 0.09912 0.44775 0.3794 0.78613 0.28027 0.33496 0.70068 0.50245 0.15381 0.05811 0.30762 0.09912 0.12646 0.01367 0.64258 0.02734l3.19238 0 3.19238 0q0.51611-0.01367 0.64258-0.04102 0.5332-0.09912 0.90234-0.46826 0.37256-0.37256 0.48536-0.90576 0.01367-0.12646 0.02734-0.29394l0-1.79102 0.3623 0q0.2666-0.01367 0.32813-0.02051 0.06494-0.00684 0.14014-0.04101 0.07861-0.0376 0.15381-0.10596 0.07861-0.07178 0.11279-0.14014 0.0376-0.07178 0.05127-0.18115 0.04101-0.19824-0.05127-0.36572-0.08887-0.16748-0.28369-0.2666-0.07178-0.02734-0.13672-0.03418-0.06152-0.00684-0.32813-0.02051l-0.34863 0 0-0.93652q0-0.75879-0.01367-0.96045-0.01367-0.20166-0.08545-0.39991-0.14014-0.42041-0.45459-0.71435-0.31445-0.29395-0.74854-0.42041-0.15381-0.04102-0.49902-0.05469-0.3418-0.01367-1.4458-0.01367l-1.42871 0 0-0.92285q0-0.67334 0-0.81348 0-0.14014-0.02734-0.2085-0.08545-0.21191-0.29395-0.3247l-0.09912-0.04102-1.28858-0.01367q-1.2749 0-1.34326 0.01367z"/></svg>`,
  giftCard: `<svg class="box-border w-[16px] shrink-0 h-[16px]" viewBox="0 0 14 14" fill="#FACC15" xmlns="http://www.w3.org/2000/svg"><path d="M4.01953 1.20313q-0.61865 0.11279-1.05957 0.54003-0.44092 0.42725-0.58105 1.02881-0.14014 0.60156 0.09912 1.17578l0.04101 0.12647-0.19482 0.01367q-0.28027 0.01367-0.45459 0.09229-0.17432 0.0752-0.35889 0.25634-0.23584 0.23926-0.30761 0.53321-0.02734 0.12646-0.02735 0.86816 0 0.7417 0.02735 0.85449 0.05811 0.23926 0.21875 0.44776 0.16064 0.2085 0.38281 0.30761 0.25293 0.12646 0.43408 0.12647l0.08545 0 0 1.77734q0 1.76367 0.02734 1.91748 0.02734 0.30762 0.16748 0.58789 0.15381 0.32471 0.44092 0.56397 0.28711 0.23584 0.65283 0.34863l0.15381 0.05469 6.4668 0 0.15381-0.05469q0.51953-0.15723 0.86133-0.56055 0.3418-0.40674 0.3999-0.93994 0.02734-0.15381 0.02734-1.91748l0-1.77734 0.08545 0q0.18115 0 0.43408-0.12647 0.22217-0.09912 0.38282-0.30761 0.16065-0.2085 0.21875-0.44776 0.02734-0.11279 0.02734-0.85449 0-0.7417-0.02734-0.86816-0.07178-0.29395-0.30762-0.53321-0.18457-0.18115-0.35889-0.25634-0.17432-0.07861-0.45459-0.09229l-0.19482-0.01367 0.04101-0.12647q0.22559-0.54688 0.10596-1.12793-0.11963-0.58105-0.52637-1.01513-0.44775-0.4751-1.11426-0.59473-0.66309-0.11963-1.30566 0.14697-0.45117 0.19824-0.85107 0.5708-0.39648 0.36914-0.70411 0.87159-0.11279 0.18115-0.12646 0.18115-0.01367 0-0.12646-0.18115-0.11279-0.18115-0.23926-0.34864-0.12305-0.16748-0.36231-0.41357-0.23926-0.24609-0.37939-0.3418-0.41699-0.30762-0.8374-0.43408-0.22559-0.07178-0.51954-0.08545-0.29395-0.01367-0.51611 0.02734z"/></svg>`,
  userPlusCard: `<svg class="box-border w-[16px] shrink-0 h-[16px]" viewBox="0 0 14 14" fill="#22C55E" xmlns="http://www.w3.org/2000/svg"><path d="M4.84326 1.20313q-0.81006 0.11279-1.42871 0.61865-0.61523 0.50244-0.89551 1.24414-0.18115 0.48877-0.18115 1.02197 0 0.28027 0.04102 0.50586 0.04443 0.22217 0.14013 0.48877 0.15381 0.46143 0.46826 0.84766 0.31787 0.38281 0.7212 0.63574 0.36572 0.22559 0.73486 0.32471 0.37256 0.0957 0.80664 0.0957 0.22559 0 0.3623-0.01367 0.14014-0.01367 0.35206-0.05811 0.60156-0.15381 1.104-0.55713 0.50586-0.40674 0.7998-0.98096 0.19482-0.39307 0.26661-0.88183 0.02734-0.14014 0.02734-0.40674 0-0.2666-0.02734-0.40674-0.09912-0.65625-0.46485-1.20312-0.3623-0.54688-0.93652-0.89551-0.43408-0.2666-0.98096-0.36572-0.15381-0.02734-0.45459-0.03418-0.30078-0.00684-0.45459 0.02051z M0.60156 1.14843q0.40674 0.02734 0.78272 0.28711 0.37939 0.25977 0.58105 0.65967 0.20508 0.39648 0.18457 0.88184-0.02051 0.48193-0.28711 0.86132-0.15381 0.23584-0.37939 0.41358-0.22217 0.17432-0.46143 0.27002-0.19482 0.05811-0.2871 0.07861-0.08887 0.02051-0.32813 0.02051-0.23926 0-0.33154-0.02051-0.08887-0.02051-0.28369-0.07861-0.39307-0.14014-0.68018-0.46826-0.28711-0.32813-0.3999-0.73487-0.10938-0.46143 0.01367-0.90918 0.12646-0.44775 0.45459-0.76904 0.33154-0.32471 0.79297-0.45117 0.08545-0.02734 0.24609-0.04785 0.16064-0.02051 0.21533-0.00684l0.16748 0.01367z m5.53028 1.75q-0.12646 0.01367-0.2461 0.10596-0.11621 0.08887-0.17431 0.21533l-0.04102 0.09912-0.01367 1.30225-0.57422 0q-0.57422 0-0.68701 0.02734-0.24951 0.02734-0.38281 0.23242-0.1333 0.20166-0.09912 0.43409 0.03418 0.229 0.24609 0.36914 0.10938 0.08545 0.229 0.09912 0.11963 0.01367 0.63916 0.01367l0.62891 0 0 0.62891q0 0.51953 0.01367 0.63916 0.01367 0.11963 0.09912 0.229 0.15381 0.22559 0.417 0.24609 0.2666 0.02051 0.46484-0.17431 0.12646-0.11279 0.15381-0.2666 0.02734-0.15381 0.02734-0.71436l0-0.58789 1.30225-0.01367 0.09912-0.04102q0.08203-0.04443 0.15722-0.11279 0.07861-0.07178 0.1128-0.14014 0.0376-0.07178 0.05127-0.18115 0.04101-0.19824-0.05127-0.36572-0.08887-0.16748-0.28369-0.2666l-0.09913-0.04102-1.28857-0.01367 0-0.58789q0-0.57422-0.02734-0.67334-0.04102-0.23584-0.23242-0.36914-0.18799-0.1333-0.44092-0.09229z"/></svg>`,
  sparklesCard: `<svg class="box-border w-[16px] shrink-0 h-[16px]" viewBox="0 0 14 14" fill="#A855F7" xmlns="http://www.w3.org/2000/svg"><path d="M4.01953 1.20313q-0.61865 0.11279-1.05957 0.54003-0.44092 0.42725-0.58105 1.02881-0.14014 0.60156 0.09912 1.17578l0.04101 0.12647-0.19482 0.01367q-0.28027 0.01367-0.45459 0.09229-0.17432 0.0752-0.35889 0.25634-0.23584 0.23926-0.30761 0.53321-0.02734 0.12646-0.02735 0.86816 0 0.7417 0.02735 0.85449 0.05811 0.23926 0.21875 0.44776 0.16064 0.2085 0.38281 0.30761 0.25293 0.12646 0.43408 0.12647l0.08545 0 0 1.77734q0 1.76367 0.02734 1.91748 0.02734 0.30762 0.16748 0.58789 0.15381 0.32471 0.44092 0.56397 0.28711 0.23584 0.65283 0.34863l0.15381 0.05469 6.4668 0 0.15381-0.05469q0.51953-0.15723 0.86133-0.56055 0.3418-0.40674 0.3999-0.93994 0.02734-0.15381 0.02734-1.91748l0-1.77734 0.08545 0q0.18115 0 0.43408-0.12647 0.22217-0.09912 0.38282-0.30761 0.16065-0.2085 0.21875-0.44776 0.02734-0.11279 0.02734-0.85449 0-0.7417-0.02734-0.86816-0.07178-0.29395-0.30762-0.53321-0.18457-0.18115-0.35889-0.25634-0.17432-0.07861-0.45459-0.09229l-0.19482-0.01367 0.04101-0.12647q0.22559-0.54688 0.10596-1.12793-0.11963-0.58105-0.52637-1.01513-0.44775-0.4751-1.11426-0.59473-0.66309-0.11963-1.30566 0.14697-0.45117 0.19824-0.85107 0.5708-0.39648 0.36914-0.70411 0.87159-0.11279 0.18115-0.12646 0.18115-0.01367 0-0.12646-0.18115-0.11279-0.18115-0.23926-0.34864-0.12305-0.16748-0.36231-0.41357-0.23926-0.24609-0.37939-0.3418-0.41699-0.30762-0.8374-0.43408-0.22559-0.07178-0.51954-0.08545-0.29395-0.01367-0.51611 0.02734z"/></svg>`,
  rocketCard: `<svg class="box-border w-[16px] shrink-0 h-[16px]" viewBox="0 0 14 14" fill="#06B6D4" xmlns="http://www.w3.org/2000/svg"><path d="M12.41748 0.60156q-2.03027 0.08545-3.80762 1.14844-0.43408 0.25293-0.81347 0.56055-0.82373 0.62891-1.43897 1.45605l-0.1709 0.22217q-0.01367 0.01367-0.16748-0.02734-0.90918-0.18115-1.58252-0.14698-0.66992 0.03418-1.11767 0.28711-0.44775 0.25293-0.78614 0.76905-0.44775 0.65967-0.71435 1.72265-0.05469 0.25293-0.06152 0.3999-0.00684 0.14697 0.04785 0.25977 0.11279 0.2085 0.3247 0.29394 0.06836 0.02734 0.26319 0.02735l2.60449 0 1.42871 1.42871 0 2.60449q0 0.19482 0.02735 0.26318 0.08545 0.21192 0.29394 0.32471 0.14014 0.06836 0.38623 0.03418 0.24609-0.03418 0.72119-0.18799 1.59619-0.49219 2.05762-1.37402 0.50244-0.96387 0.12646-2.70019l-0.02734-0.12647q0-0.02734 0.02734-0.04443 0.0957-0.05469 0.54688-0.43409 1.16211-0.99121 1.86621-2.30712 0.70752-1.31592 0.90576-2.83008 0.02734-0.29395 0.04785-0.67676 0.02051-0.38623 0.00684-0.47168-0.04101-0.2085-0.18799-0.3418-0.14697-0.1333-0.37256-0.14697-0.12646 0-0.43408 0.01367z"/></svg>`
};

function renderBadges(badges) {
  if (!badges || badges.length === 0) return '';
  return badges.map(b => SVG_BADGES[b] || '').join(' ');
}

// Render functions for Chat feed items using Pencil exact markup
function renderEventItem(event) {
  const container = getFeedContainer();
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'w-full shrink-0 animate-fadeIn';

  wrapper.setAttribute('data-event-type', event.type);

  if (event.type === 'CHAT_MESSAGE') {
    const isBot = event.user.username.toLowerCase() === 'nightbot' || event.user.is_bot;
    const isCommand = event.message.startsWith('!');
    const fontClass = (isBot || isCommand) ? "font-['Geist_Mono',system-ui,sans-serif]" : "font-[Inter,system-ui,sans-serif]";
    const userColor = event.user.color || (isBot ? '#A1A1AA' : '#06B6D4');
    const badgesHtml = renderBadges(event.user.badges || (isBot ? ['bot'] : []));

    wrapper.innerHTML = `
      <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[8px] justify-start items-start">
        <div class="box-border w-fit shrink-0 h-fit flex flex-row gap-[4px] justify-start items-center">
          <div class="text-[12.5px]/[normal] box-border font-[Inter,system-ui,sans-serif] font-semibold text-left [white-space:nowrap]" style="color: ${userColor};">
            ${escapeHtml(event.user.username)}
          </div>
          ${badgesHtml}
        </div>
        <div class="text-[12.5px]/[18px] box-border flex-1 text-[#F4F4F6] ${fontClass} font-normal text-left break-words">
          ${escapeHtml(event.message)}
        </div>
      </div>
    `;
  } else if (event.type === 'DONATE') {
    const amount = event.extra?.amount || '500 ₽';
    wrapper.innerHTML = `
      <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[8px] p-[8px_10px] justify-start items-start bg-[#131318] [border-width:0px_0px_0px_3px] [border-style:solid] [border-color:#FACC15] rounded-[10px]">
        ${SVG_BADGES.giftCard}
        <div class="box-border flex-1 h-fit flex flex-col gap-[2px] justify-start items-start">
          <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center">
            <div class="text-[12px]/[normal] box-border text-[#F4F4F6] font-[Inter,system-ui,sans-serif] font-semibold text-left [white-space:nowrap]">
              Донат от ${escapeHtml(event.user.username)}
            </div>
            <div class="box-border flex-1 h-full flex flex-row gap-0 justify-start items-start"></div>
            <div class="text-[12px]/[normal] box-border text-[#FACC15] font-[Inter,system-ui,sans-serif] font-bold text-left [white-space:nowrap]">
              ${escapeHtml(amount)}
            </div>
          </div>
          <div class="text-[12px]/[16px] box-border w-full text-[#A1A1AA] font-[Inter,system-ui,sans-serif] font-normal text-left break-words">
            ${escapeHtml(event.message || '')}
          </div>
        </div>
      </div>
    `;
  } else if (event.type === 'SUBSCRIBE') {
    const extraText = event.extra?.months ? `${event.extra.months} мес.` : (event.extra?.tier || 'Sub');
    wrapper.innerHTML = `
      <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[8px] p-[8px_10px] justify-start items-start bg-[#131318] [border-width:0px_0px_0px_3px] [border-style:solid] [border-color:#A855F7] rounded-[10px]">
        ${SVG_BADGES.sparklesCard}
        <div class="box-border flex-1 h-fit flex flex-col gap-[2px] justify-start items-start">
          <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center">
            <div class="text-[12px]/[normal] box-border text-[#F4F4F6] font-[Inter,system-ui,sans-serif] font-semibold text-left [white-space:nowrap]">
              ${escapeHtml(event.user.username)} оформил подписку
            </div>
            <div class="box-border flex-1 h-full flex flex-row gap-0 justify-start items-start"></div>
            <div class="text-[12px]/[normal] box-border text-[#A855F7] font-[Inter,system-ui,sans-serif] font-bold text-left [white-space:nowrap]">
              ${escapeHtml(extraText)}
            </div>
          </div>
          <div class="text-[12px]/[16px] box-border w-full text-[#A1A1AA] font-[Inter,system-ui,sans-serif] font-normal text-left break-words">
            ${escapeHtml(event.message || 'спасибо за поддержку!')}
          </div>
        </div>
      </div>
    `;
  } else if (event.type === 'FOLLOW') {
    wrapper.innerHTML = `
      <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[8px] p-[8px_10px] justify-start items-start bg-[#131318] [border-width:0px_0px_0px_3px] [border-style:solid] [border-color:#22C55E] rounded-[10px]">
        ${SVG_BADGES.userPlusCard}
        <div class="box-border flex-1 h-fit flex flex-col gap-[2px] justify-start items-start">
          <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center">
            <div class="text-[12px]/[normal] box-border text-[#F4F4F6] font-[Inter,system-ui,sans-serif] font-semibold text-left [white-space:nowrap]">
              Новый фолловер: ${escapeHtml(event.user.username)}
            </div>
            <div class="box-border flex-1 h-full flex flex-row gap-0 justify-start items-start"></div>
            <div class="text-[12px]/[normal] box-border text-[#22C55E] font-[Inter,system-ui,sans-serif] font-bold text-left [white-space:nowrap]">
              +1
            </div>
          </div>
          <div class="text-[12px]/[16px] box-border w-full text-[#A1A1AA] font-[Inter,system-ui,sans-serif] font-normal text-left break-words">
            ${escapeHtml(event.message || 'спасибо, что залетел на огонёк!')}
          </div>
        </div>
      </div>
    `;
  } else if (event.type === 'RAID') {
    const viewersText = event.extra?.viewers ? `${event.extra.viewers} зрителей` : 'Рейд';
    wrapper.innerHTML = `
      <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[8px] p-[8px_10px] justify-start items-start bg-[#131318] [border-width:0px_0px_0px_3px] [border-style:solid] [border-color:#06B6D4] rounded-[10px]">
        ${SVG_BADGES.rocketCard}
        <div class="box-border flex-1 h-fit flex flex-col gap-[2px] justify-start items-start">
          <div class="box-border w-full h-fit shrink-0 flex flex-row gap-[6px] justify-start items-center">
            <div class="text-[12px]/[normal] box-border text-[#F4F4F6] font-[Inter,system-ui,sans-serif] font-semibold text-left [white-space:nowrap]">
              Рейд от ${escapeHtml(event.user.username)}
            </div>
            <div class="box-border flex-1 h-full flex flex-row gap-0 justify-start items-start"></div>
            <div class="text-[12px]/[normal] box-border text-[#06B6D4] font-[Inter,system-ui,sans-serif] font-bold text-left [white-space:nowrap]">
              ${escapeHtml(viewersText)}
            </div>
          </div>
          <div class="text-[12px]/[16px] box-border w-full text-[#A1A1AA] font-[Inter,system-ui,sans-serif] font-normal text-left break-words">
            ${escapeHtml(event.message || 'привет от рейда!')}
          </div>
        </div>
      </div>
    `;
  }

  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

function switchTab(tab) {
  const tabs = document.querySelectorAll('.tab-item');
  tabs.forEach(t => {
    t.classList.remove('bg-[#A855F7]');
    t.classList.add('bg-[#1B1B23]');
    const label = t.querySelector('div');
    if (label) {
      label.classList.remove('text-[#FFFFFF]', 'font-semibold');
      label.classList.add('text-[#A1A1AA]', 'font-medium');
    }
  });

  const activeTab = document.getElementById(`tab-${tab}`);
  if (activeTab) {
    activeTab.classList.remove('bg-[#1B1B23]');
    activeTab.classList.add('bg-[#A855F7]');
    const label = activeTab.querySelector('div');
    if (label) {
      label.classList.remove('text-[#A1A1AA]', 'font-medium');
      label.classList.add('text-[#FFFFFF]', 'font-semibold');
    }
  }

  const container = getFeedContainer();
  if (!container) return;

  const items = container.children;
  for (let item of items) {
    const isEventCard = item.querySelector('.bg-\\[\\#131318\\]') !== null;
    const isDonate = isEventCard && item.innerHTML.includes('Донат');

    if (tab === 'all') {
      item.style.display = '';
    } else if (tab === 'messages') {
      item.style.display = isEventCard ? 'none' : '';
    } else if (tab === 'events') {
      item.style.display = isEventCard ? '' : 'none';
    } else if (tab === 'donates') {
      item.style.display = isDonate ? '' : 'none';
    }
  }
}

function renderBadges(badges) {
  if (!badges || badges.length === 0) return '';
  return badges.map(b => {
    if (b.includes('fa-') || b.includes('text-')) {
      return `<i class="${b}"></i>`;
    }
    if (b === 'shield') {
      return `<i class="fas fa-shield text-cyan-400 text-[11px]"></i>`;
    } else if (b === 'crown') {
      return `<i class="fas fa-crown text-amber-400 text-[11px]"></i>`;
    } else if (b === 'heart') {
      return `<i class="fas fa-heart text-pink-500 text-[11px]"></i>`;
    } else if (b === 'sparkles') {
      return `<i class="fas fa-sparkles text-purple-400 text-[11px]"></i>`;
    }
    return '';
  }).join(' ');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sendChat() {
  const input = document.getElementById('chat-input');
  if (!input || !input.value.trim()) return;
  const msg = input.value.trim();
  input.value = '';

  if (window.go && window.go.main && window.go.main.App) {
    window.go.main.App.SendChatMessage(msg);
  } else {
    renderEventItem({
      type: 'CHAT_MESSAGE',
      user: { username: 'kristi_plays', color: '#A855F7', badges: ['crown'] },
      message: msg
    });
  }
}

function testTTS() {
  const voice = document.getElementById('cfg-tts-voice')?.value;
  if (window.go && window.go.main && window.go.main.App) {
    window.go.main.App.TestTTS(voice, "Тестовая озвучка ReChat настроена и готова!");
  }
}

function saveConfigFromUI() {
  const config = {
    tts_enabled: document.getElementById('cfg-tts-enabled')?.checked,
    tts_voice: document.getElementById('cfg-tts-voice')?.value,
    tts_speed: parseFloat(document.getElementById('cfg-tts-speed')?.value || '1.0'),
    tts_pitch: parseFloat(document.getElementById('cfg-tts-pitch')?.value || '1.0'),
    tts_for_donates: document.getElementById('cfg-tts-donates')?.checked,
    tts_for_subs: document.getElementById('cfg-tts-subs')?.checked,
    min_donate_amount: parseFloat(document.getElementById('cfg-min-donate')?.value || '50'),
  };

  if (window.go && window.go.main && window.go.main.App) {
    window.go.main.App.SaveSettings(config);
  }
}

// Initialize Wails Event Listeners & Load Data
window.addEventListener('DOMContentLoaded', () => {
  if (window.go && window.go.main && window.go.main.App) {
    if (window.go.main.App.GetMode) {
      window.go.main.App.GetMode().then(mode => {
        const isSettingsPage = window.location.pathname.endsWith('settings.html');
        if (mode === 'settings' && !isSettingsPage) {
          window.location.replace('settings.html');
          return;
        }
      });
    }

    window.go.main.App.GetInitialEvents().then(events => {
      if (events) events.forEach(renderEventItem);
    });

    if (window.runtime && window.runtime.EventsOn) {
      window.runtime.EventsOn("stream:event", (event) => {
        renderEventItem(event);
      });
    }
  }
});
