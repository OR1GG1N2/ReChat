//go:build !windows

package overlay

func FindMainWindow() uintptr {
	return 0
}

func EnableWindowTransparency(hwnd uintptr) {
	// Not supported
}

func SetClickThrough(hwnd uintptr, enable bool) {
	// Not supported on non-windows platforms
}

func StartGlobalHotkey(onTrigger func(), onSkipTTS ...func()) {
	// Not supported on non-windows platforms
}

func StopGlobalHotkey() {
	// Not supported on non-windows platforms
}
