package main

import (
	"embed"
	"flag"
	"io/fs"
	"net/http"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var assets embed.FS

type customAssetHandler struct {
	mode    string
	handler http.Handler
}

func (h *customAssetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/" || r.URL.Path == "/index.html" {
		if h.mode == "chat" {
			r.URL.Path = "/chat.html"
		} else if h.mode == "settings" {
			r.URL.Path = "/settings.html"
		}
	}
	h.handler.ServeHTTP(w, r)
}

func main() {
	modeFlag := flag.String("mode", "chat", "Window mode: chat (default), settings")
	flag.Parse()

	mode := *modeFlag
	app := NewApp(mode)

	title := "ReChat - Only Chat"
	width := 367
	height := 657
	minWidth := 367
	minHeight := 657
	alwaysOnTop := true

	if mode == "settings" {
		title = "StreamVoice - Панель стримера"
		width = 1020
		height = 659
		minWidth = 1020
		minHeight = 659
		alwaysOnTop = false
	}

	subFS, _ := fs.Sub(assets, "frontend")

	err := wails.Run(&options.App{
		Title:         title,
		Width:         width,
		Height:        height,
		MinWidth:      minWidth,
		MinHeight:     minHeight,
		MaxWidth:      width,
		MaxHeight:     height,
		DisableResize: true,
		AlwaysOnTop:   alwaysOnTop,
		AssetServer: &assetserver.Options{
			Assets: assets,
			Handler: &customAssetHandler{
				mode:    mode,
				handler: http.FileServer(http.FS(subFS)),
			},
		},
		BackgroundColour: &options.RGBA{R: 11, G: 11, B: 15, A: 255},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error starting ReChat:", err.Error())
	}
}
