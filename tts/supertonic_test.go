package tts

import (
	"strings"
	"testing"
)

func TestSupertonicManager(t *testing.T) {
	mgr := NewSupertonicManager()
	defer mgr.Close()

	status := mgr.GetStatus()
	t.Logf("Installed: %v, ModelDir: %s", status.Installed, status.ModelDir)

	if !status.Installed {
		t.Fatalf("Expected model to be installed since files are present on disk")
	}

	uri, err := mgr.GenerateSpeech("Привет! Это проверка нейросети.", "M1")
	if err != nil {
		t.Fatalf("GenerateSpeech failed: %v", err)
	}

	if !strings.HasPrefix(uri, "data:audio/wav;base64,") {
		t.Fatalf("Invalid dataUri prefix: %s", uri[:min(30, len(uri))])
	}

	t.Logf("Synthesis success! Data URI length: %d bytes", len(uri))
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
