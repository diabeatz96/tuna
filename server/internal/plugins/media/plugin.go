package media

import (
	"github.com/m1k1o/neko/server/pkg/types"
)

// Plugin is Tuna's room-wide play, pause and seek: any member may control the video in the browser
// for everyone without taking control of the desktop
type Plugin struct {
	config  *Config
	manager *Manager
}

func NewPlugin() *Plugin {
	return &Plugin{
		config: &Config{},
	}
}

func (p *Plugin) Name() string {
	return PluginName
}

func (p *Plugin) Config() types.PluginConfig {
	return p.config
}

func (p *Plugin) Start(m types.PluginManagers) error {
	p.manager = NewManager(m.SessionManager, p.config)
	m.ApiManager.AddRouter("/media", p.manager.Route)
	m.WebSocketManager.AddHandler(p.manager.WebSocketHandler)
	return p.manager.Start()
}

func (p *Plugin) Shutdown() error {
	return p.manager.Shutdown()
}
