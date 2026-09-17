//go:build windows

package overlay

import (
	"log"
	"os"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	dwmapi   = syscall.NewLazyDLL("dwmapi.dll")

	procEnumWindows              = user32.NewProc("EnumWindows")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
	procIsWindowVisible          = user32.NewProc("IsWindowVisible")
	procIsWindow                 = user32.NewProc("IsWindow")
	procGetWindowLongPtrW        = user32.NewProc("GetWindowLongPtrW")
	procGetWindowLongW           = user32.NewProc("GetWindowLongW")
	procSetWindowLongPtrW        = user32.NewProc("SetWindowLongPtrW")
	procSetWindowLongW           = user32.NewProc("SetWindowLongW")
	procSetWindowPos             = user32.NewProc("SetWindowPos")
	procRegisterHotKey           = user32.NewProc("RegisterHotKey")
	procUnregisterHotKey         = user32.NewProc("UnregisterHotKey")
	procGetMessageW              = user32.NewProc("GetMessageW")
	procPeekMessageW             = user32.NewProc("PeekMessageW")
	procPostThreadMessageW       = user32.NewProc("PostThreadMessageW")
	procGetCurrentThreadId       = kernel32.NewProc("GetCurrentThreadId")
	procGetClassNameW            = user32.NewProc("GetClassNameW")
	procGetWindowTextW           = user32.NewProc("GetWindowTextW")
	procSetWindowsHookExW        = user32.NewProc("SetWindowsHookExW")
	procUnhookWindowsHookEx      = user32.NewProc("UnhookWindowsHookEx")
	procCallNextHookEx           = user32.NewProc("CallNextHookEx")
	procGetAsyncKeyState         = user32.NewProc("GetAsyncKeyState")

	procDwmExtendFrameIntoClientArea = dwmapi.NewProc("DwmExtendFrameIntoClientArea")
	procDwmSetWindowAttribute        = dwmapi.NewProc("DwmSetWindowAttribute")
)

type MARGINS struct {
	CxLeftWidth    int32
	CxRightWidth   int32
	CyTopHeight    int32
	CyBottomHeight int32
}

const (
	GWL_STYLE   = -16
	GWL_EXSTYLE = -20

	WS_BORDER     = 0x00800000
	WS_DLGFRAME   = 0x00400000
	WS_THICKFRAME = 0x00040000
	WS_CAPTION    = 0x00C00000

	WS_EX_TRANSPARENT = 0x00000020
	WS_EX_LAYERED     = 0x00080000

	SWP_NOMOVE       = 0x0002
	SWP_NOSIZE       = 0x0001
	SWP_NOZORDER     = 0x0004
	SWP_FRAMECHANGED = 0x0020

	MOD_ALT      = 0x0001
	MOD_CONTROL  = 0x0002
	MOD_SHIFT    = 0x0004
	MOD_NOREPEAT = 0x4000

	WM_KEYDOWN    = 0x0100
	WM_KEYUP      = 0x0101
	WM_SYSKEYDOWN = 0x0104
	WM_SYSKEYUP   = 0x0105
	WM_HOTKEY     = 0x0312
	WM_QUIT       = 0x0012

	WH_KEYBOARD_LL = 13

	VK_SHIFT   = 0x10
	VK_CONTROL = 0x11
	VK_MENU    = 0x12 // Alt
	VK_ESCAPE  = 0x1B
	VK_F8      = 0x77
	VK_G       = 0x47
	VK_O       = 0x4F
	VK_S       = 0x53

	DWMWA_NCRENDERING_POLICY       = 2
	DWMWA_WINDOW_CORNER_PREFERENCE = 33
	DWMWA_BORDER_COLOR             = 34

	DWMNCRP_USEWINDOWSTYLE = 0
	DWMNCRP_DISABLED       = 1

	DWMWCP_DEFAULT    = 0
	DWMWCP_DONOTROUND = 1

	DWMWA_COLOR_DEFAULT = 0xFFFFFFFF
	DWMWA_COLOR_NONE    = 0xFFFFFFFE
)

type KBDLLHOOKSTRUCT struct {
	VkCode      uint32
	ScanCode    uint32
	Flags       uint32
	Time        uint32
	DwExtraInfo uintptr
}

func getWindowLong(hwnd uintptr, index int32) uintptr {
	if procGetWindowLongPtrW.Find() == nil {
		r, _, _ := procGetWindowLongPtrW.Call(hwnd, uintptr(index))
		return r
	}
	r, _, _ := procGetWindowLongW.Call(hwnd, uintptr(index))
	return r
}

func setWindowLong(hwnd uintptr, index int32, value uintptr) uintptr {
	if procSetWindowLongPtrW.Find() == nil {
		r, _, _ := procSetWindowLongPtrW.Call(hwnd, uintptr(index), value)
		return r
	}
	r, _, _ := procSetWindowLongW.Call(hwnd, uintptr(index), value)
	return r
}

var (
	cachedMainWindow uintptr
	cachedMu         sync.Mutex
)

// FindMainWindow locates the main visible window belonging to the current process.
func FindMainWindow() uintptr {
	cachedMu.Lock()
	if cachedMainWindow != 0 {
		ret, _, _ := procIsWindow.Call(cachedMainWindow)
		if ret != 0 {
			hwnd := cachedMainWindow
			cachedMu.Unlock()
			return hwnd
		}
		cachedMainWindow = 0
	}
	cachedMu.Unlock()

	var mainHwnd uintptr
	pid := uint32(os.Getpid())

	cb := syscall.NewCallback(func(hwnd uintptr, lparam uintptr) uintptr {
		var windowPID uint32
		procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&windowPID)))
		if windowPID == pid {
			var className [256]uint16
			procGetClassNameW.Call(hwnd, uintptr(unsafe.Pointer(&className[0])), 256)
			cls := syscall.UTF16ToString(className[:])
			if cls == "wailsWindow" {
				mainHwnd = hwnd
				return 0 // stop enumeration, found primary Wails window
			}

			var text [256]uint16
			procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&text[0])), 256)
			title := syscall.UTF16ToString(text[:])
			if strings.Contains(title, "ReChat") {
				mainHwnd = hwnd
			}
		}
		return 1 // continue
	})

	procEnumWindows.Call(cb, 0)

	if mainHwnd != 0 {
		cachedMu.Lock()
		cachedMainWindow = mainHwnd
		cachedMu.Unlock()
	}

	return mainHwnd
}

// EnableWindowTransparency ensures DWM extends glass frame into client area
func EnableWindowTransparency(hwnd uintptr) {
	if hwnd == 0 {
		hwnd = FindMainWindow()
		if hwnd == 0 {
			return
		}
	}
	margins := MARGINS{-1, -1, -1, -1}
	procDwmExtendFrameIntoClientArea.Call(hwnd, uintptr(unsafe.Pointer(&margins)))
}

var (
	styleMu    sync.Mutex
	savedStyle uintptr
	styleSaved bool
)

// SetClickThrough enables or disables mouse click-through and completely hides window borders/shadows in Game Mode.
func SetClickThrough(hwnd uintptr, enable bool) {
	if hwnd == 0 {
		hwnd = FindMainWindow()
		if hwnd == 0 {
			log.Printf("[GameMode] Warning: Main window HWND not found")
			return
		}
	}

	exStyle := getWindowLong(hwnd, GWL_EXSTYLE)
	style := getWindowLong(hwnd, GWL_STYLE)

	styleMu.Lock()
	if enable {
		if !styleSaved {
			savedStyle = style
			styleSaved = true
		}

		// 1. Remove resize frame, borders, and dialog frames to remove Win11 1px border
		newStyle := style &^ uintptr(WS_THICKFRAME | WS_BORDER | WS_DLGFRAME | WS_CAPTION)
		setWindowLong(hwnd, GWL_STYLE, newStyle)

		// 2. Enable click-through and layered window styles
		exStyle |= WS_EX_TRANSPARENT | WS_EX_LAYERED
		setWindowLong(hwnd, GWL_EXSTYLE, exStyle)

		// 3. Disable Windows 11 rounded corners (DWMWA_WINDOW_CORNER_PREFERENCE = 33 -> DWMWCP_DONOTROUND = 1)
		cornerPref := uint32(DWMWCP_DONOTROUND)
		procDwmSetWindowAttribute.Call(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, uintptr(unsafe.Pointer(&cornerPref)), 4)

		// 4. Disable window border (DWMWA_BORDER_COLOR = 34 -> DWMWA_COLOR_NONE = 0xFFFFFFFE)
		borderColor := uint32(DWMWA_COLOR_NONE)
		procDwmSetWindowAttribute.Call(hwnd, DWMWA_BORDER_COLOR, uintptr(unsafe.Pointer(&borderColor)), 4)

		// 5. Disable non-client rendering policy (DWMWA_NCRENDERING_POLICY = 2 -> DWMNCRP_DISABLED = 1)
		ncPolicy := uint32(DWMNCRP_DISABLED)
		procDwmSetWindowAttribute.Call(hwnd, DWMWA_NCRENDERING_POLICY, uintptr(unsafe.Pointer(&ncPolicy)), 4)

		// 6. Reset DWM frame extension to (0,0,0,0) so DWM does NOT draw acrylic/glass tint box
		margins := MARGINS{0, 0, 0, 0}
		procDwmExtendFrameIntoClientArea.Call(hwnd, uintptr(unsafe.Pointer(&margins)))

		log.Printf("[GameMode] Click-through and 100%% borderless transparency ENABLED (hwnd: 0x%x)", hwnd)
	} else {
		// 1. Restore normal styles so user can resize the window normally
		if styleSaved && savedStyle != 0 {
			setWindowLong(hwnd, GWL_STYLE, savedStyle)
			styleSaved = false
		} else {
			setWindowLong(hwnd, GWL_STYLE, style|uintptr(WS_THICKFRAME))
		}

		// 2. Disable click-through
		exStyle &= ^uintptr(WS_EX_TRANSPARENT)
		setWindowLong(hwnd, GWL_EXSTYLE, exStyle)

		// 3. Restore default rounded corners
		cornerPref := uint32(DWMWCP_DEFAULT)
		procDwmSetWindowAttribute.Call(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, uintptr(unsafe.Pointer(&cornerPref)), 4)

		// 4. Restore default border color
		borderColor := uint32(DWMWA_COLOR_DEFAULT)
		procDwmSetWindowAttribute.Call(hwnd, DWMWA_BORDER_COLOR, uintptr(unsafe.Pointer(&borderColor)), 4)

		// 5. Restore default non-client rendering
		ncPolicy := uint32(DWMNCRP_USEWINDOWSTYLE)
		procDwmSetWindowAttribute.Call(hwnd, DWMWA_NCRENDERING_POLICY, uintptr(unsafe.Pointer(&ncPolicy)), 4)

		margins := MARGINS{-1, -1, -1, -1}
		procDwmExtendFrameIntoClientArea.Call(hwnd, uintptr(unsafe.Pointer(&margins)))

		log.Printf("[GameMode] Click-through DISABLED (hwnd: 0x%x)", hwnd)
	}
	styleMu.Unlock()

	// 7. Force Windows and DWM to immediately update frame geometry
	procSetWindowPos.Call(
		hwnd,
		0,
		0, 0, 0, 0,
		SWP_NOMOVE|SWP_NOSIZE|SWP_NOZORDER|SWP_FRAMECHANGED,
	)
}

// HotkeyManager manages global hotkey registration and low-level keyboard hook.
type HotkeyManager struct {
	mu                sync.Mutex
	threadID          uint32
	hHook             uintptr
	hotkeyID1         int
	hotkeyID2         int
	onTrigger         func()
	onSkipTTS         func()
	lastToggleTrigger time.Time
	lastSkipTrigger   time.Time
}

var globalHotkeyManager = &HotkeyManager{
	hotkeyID1: 7711, // Primary ID: Ctrl + Shift + G
	hotkeyID2: 7712, // Secondary ID: Ctrl + Shift + O (Overlay)
}

// StartGlobalHotkey registers global hotkeys and a low-level keyboard hook to guarantee
// reliable shortcut detection across games, elevated windows, and transparent overlay mode.
func StartGlobalHotkey(onTrigger func(), onSkipTTS ...func()) {
	globalHotkeyManager.mu.Lock()
	defer globalHotkeyManager.mu.Unlock()

	globalHotkeyManager.onTrigger = onTrigger
	if len(onSkipTTS) > 0 {
		globalHotkeyManager.onSkipTTS = onSkipTTS[0]
	}
	ready := make(chan struct{})

	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		tid, _, _ := procGetCurrentThreadId.Call()
		globalHotkeyManager.mu.Lock()
		globalHotkeyManager.threadID = uint32(tid)
		globalHotkeyManager.mu.Unlock()

		type MSG struct {
			Hwnd    uintptr
			Message uint32
			WParam  uintptr
			LParam  uintptr
			Time    uint32
			Pt      struct{ X, Y int32 }
		}

		// Force the creation of the thread's message queue before registering hooks/hotkeys!
		var dummy MSG
		procPeekMessageW.Call(uintptr(unsafe.Pointer(&dummy)), 0, 0, 0, 0) // PM_NOREMOVE = 0

		// 1. Install Low-Level Keyboard Hook (WH_KEYBOARD_LL)
		// This intercepts shortcuts globally even when ReChat has no focus (WS_EX_TRANSPARENT overlay mode)
		// and regardless of active keyboard layout (Russian/English)
		hookCb := syscall.NewCallback(func(nCode int32, wParam uintptr, lParam uintptr) uintptr {
			if nCode >= 0 && (wParam == WM_KEYDOWN || wParam == WM_SYSKEYDOWN) {
				kb := (*KBDLLHOOKSTRUCT)(unsafe.Pointer(lParam))

				ctrlState, _, _ := procGetAsyncKeyState.Call(VK_CONTROL)
				shiftState, _, _ := procGetAsyncKeyState.Call(VK_SHIFT)
				altState, _, _ := procGetAsyncKeyState.Call(VK_MENU)

				hasCtrl := (ctrlState & 0x8000) != 0
				hasShift := (shiftState & 0x8000) != 0
				hasAlt := (altState & 0x8000) != 0

				// Check for Game Mode toggle: Ctrl + Shift + G ('G'=0x47) or Ctrl + Shift + O ('O'=0x4F)
				if hasCtrl && hasShift && !hasAlt && (kb.VkCode == VK_G || kb.VkCode == VK_O) {
					globalHotkeyManager.mu.Lock()
					now := time.Now()
					if now.Sub(globalHotkeyManager.lastToggleTrigger) > 350*time.Millisecond {
						globalHotkeyManager.lastToggleTrigger = now
						fn := globalHotkeyManager.onTrigger
						globalHotkeyManager.mu.Unlock()
						if fn != nil {
							go fn()
						}
					} else {
						globalHotkeyManager.mu.Unlock()
					}
				}

				// Check for TTS Skip: Escape (no modifiers) or F8 or Ctrl + Shift + S
				isSkipKey := (kb.VkCode == VK_ESCAPE && !hasCtrl && !hasShift && !hasAlt) ||
					(kb.VkCode == VK_F8) ||
					(hasCtrl && hasShift && kb.VkCode == VK_S)

				if isSkipKey {
					globalHotkeyManager.mu.Lock()
					now := time.Now()
					if now.Sub(globalHotkeyManager.lastSkipTrigger) > 300*time.Millisecond {
						globalHotkeyManager.lastSkipTrigger = now
						fn := globalHotkeyManager.onSkipTTS
						globalHotkeyManager.mu.Unlock()
						if fn != nil {
							go fn()
						}
					} else {
						globalHotkeyManager.mu.Unlock()
					}
				}
			}
			r, _, _ := procCallNextHookEx.Call(0, uintptr(nCode), wParam, lParam)
			return r
		})

		hHook, _, errHook := procSetWindowsHookExW.Call(WH_KEYBOARD_LL, hookCb, 0, 0)
		if hHook != 0 {
			globalHotkeyManager.mu.Lock()
			globalHotkeyManager.hHook = hHook
			globalHotkeyManager.mu.Unlock()
			log.Printf("[GameMode] Global low-level keyboard hook active (Ctrl+Shift+G / Ctrl+Shift+O / Esc)")
		} else {
			log.Printf("[GameMode] Warning: SetWindowsHookExW failed: %v", errHook)
		}

		// 2. Also register standard HotKeys as redundant backup
		procRegisterHotKey.Call(0, uintptr(globalHotkeyManager.hotkeyID1), MOD_CONTROL|MOD_SHIFT, uintptr('G'))
		procRegisterHotKey.Call(0, uintptr(globalHotkeyManager.hotkeyID2), MOD_CONTROL|MOD_SHIFT, uintptr('O'))

		close(ready)

		// Message loop required to pump low-level hook and hotkey events
		var msg MSG
		for {
			r, _, _ := procGetMessageW.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(r) <= 0 || msg.Message == WM_QUIT {
				break
			}
			if msg.Message == WM_HOTKEY && (msg.WParam == uintptr(globalHotkeyManager.hotkeyID1) || msg.WParam == uintptr(globalHotkeyManager.hotkeyID2)) {
				globalHotkeyManager.mu.Lock()
				now := time.Now()
				if now.Sub(globalHotkeyManager.lastToggleTrigger) > 350*time.Millisecond {
					globalHotkeyManager.lastToggleTrigger = now
					fn := globalHotkeyManager.onTrigger
					globalHotkeyManager.mu.Unlock()
					if fn != nil {
						go fn()
					}
				} else {
					globalHotkeyManager.mu.Unlock()
				}
			}
		}

		if hHook != 0 {
			procUnhookWindowsHookEx.Call(hHook)
		}
		procUnregisterHotKey.Call(0, uintptr(globalHotkeyManager.hotkeyID1))
		procUnregisterHotKey.Call(0, uintptr(globalHotkeyManager.hotkeyID2))
	}()

	<-ready
}

// StopGlobalHotkey terminates the global hotkey hook and message loop.
func StopGlobalHotkey() {
	globalHotkeyManager.mu.Lock()
	defer globalHotkeyManager.mu.Unlock()

	if globalHotkeyManager.hHook != 0 {
		procUnhookWindowsHookEx.Call(globalHotkeyManager.hHook)
		globalHotkeyManager.hHook = 0
	}
	if globalHotkeyManager.threadID != 0 {
		procPostThreadMessageW.Call(uintptr(globalHotkeyManager.threadID), WM_QUIT, 0, 0)
		globalHotkeyManager.threadID = 0
	}
}
