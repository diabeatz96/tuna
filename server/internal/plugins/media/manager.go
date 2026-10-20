package media

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/m1k1o/neko/server/pkg/types"
)

// how far the video may be from where it should be before a poll calls it a seek
const driftSeconds = 4

// one member's controls at most this often
const controlEvery = 300 * time.Millisecond

func NewManager(sessions types.SessionManager, config *Config) *Manager {
	return &Manager{
		logger:   log.With().Str("module", "media").Logger(),
		config:   config,
		sessions: sessions,
		devtools: newDevtools(config.DevTools),
		controls: map[string]time.Time{},
	}
}

// Manager plays, pauses and seeks the video in the browser's visible tab for everyone, over the
// browser's DevTools, and tells the room what is playing
type Manager struct {
	logger   zerolog.Logger
	config   *Config
	sessions types.SessionManager
	devtools *devtools

	mu       sync.Mutex
	last     State     // what was last told to the room
	lastAt   time.Time // when
	controls map[string]time.Time

	cancel context.CancelFunc
	wg     sync.WaitGroup
}

var errNoVideo = errors.New("no video in the visible tab")

// read finds the video in the visible tab (or a cross-site frame in it), applies the action when there
// is one, and reports it with the tab's title
func (m *Manager) read(ctx context.Context, action string, seconds float64) (State, error) {
	targets, err := m.devtools.targets(ctx)
	if err != nil {
		return State{}, err
	}

	titles := map[string]string{}
	var visiblePage string
	var chosen *target
	var found probe
	for i := range targets {
		t := targets[i]
		var p probe
		if err := m.devtools.evaluate(ctx, t, script("", 0), &p); err != nil {
			m.logger.Debug().Err(err).Str("target", t.URL).Msg("could not read target")
			continue
		}
		if t.Type == "page" {
			titles[t.ID] = t.Title
			if p.Visible && visiblePage == "" {
				visiblePage = t.ID
			}
		}
		if p.Found && p.Visible && chosen == nil {
			chosen, found = &targets[i], p
		}
	}
	if chosen == nil {
		return State{Title: titles[visiblePage]}, errNoVideo
	}

	if action != "" {
		if err := m.devtools.evaluate(ctx, *chosen, script(action, seconds), &found); err != nil {
			return State{}, err
		}
	}

	title := titles[chosen.ID]
	if chosen.Type == "iframe" {
		title = titles[chosen.ParentID]
		if title == "" {
			title = titles[visiblePage]
		}
	}
	return State{
		Found:    true,
		Paused:   found.Paused,
		Time:     found.Time,
		Duration: found.Duration,
		Title:    title,
	}, nil
}

// changed: a different video or title, play or pause, or a jump (a seek nobody sent through Tuna)
func changed(last State, lastAt time.Time, now State, at time.Time) bool {
	if last.Found != now.Found || last.Paused != now.Paused || last.Title != now.Title {
		return true
	}
	if !now.Found {
		return false
	}
	expected := last.Time
	if !last.Paused {
		expected += at.Sub(lastAt).Seconds()
	}
	return math.Abs(now.Time-expected) > driftSeconds
}

func (m *Manager) publish(state State) {
	m.mu.Lock()
	m.last, m.lastAt = state, time.Now()
	m.mu.Unlock()
	m.sessions.Broadcast(MEDIA_STATE, state)
}

func (m *Manager) anyoneConnected() bool {
	connected := false
	m.sessions.Range(func(s types.Session) bool {
		connected = s.State().IsConnected
		return !connected
	})
	return connected
}

func (m *Manager) poll(ctx context.Context) {
	defer m.wg.Done()
	ticker := time.NewTicker(m.config.Poll)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		if !m.anyoneConnected() {
			continue
		}

		readCtx, cancel := context.WithTimeout(ctx, m.config.Poll)
		state, err := m.read(readCtx, "", 0)
		cancel()
		if err != nil && !errors.Is(err, errNoVideo) {
			m.logger.Debug().Err(err).Msg("could not read the browser")
			continue
		}

		m.mu.Lock()
		last, lastAt := m.last, m.lastAt
		m.mu.Unlock()
		if changed(last, lastAt, state, time.Now()) {
			m.publish(state)
		}
	}
}

// admins always; members who may host, unless the controls are locked
func (m *Manager) canControl(session types.Session) bool {
	profile := session.Profile()
	if profile.IsAdmin {
		return true
	}
	return profile.CanHost && !m.sessions.Settings().LockedControls
}

func (m *Manager) control(session types.Session, c Control) {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	state, err := m.read(ctx, c.Action, c.Seconds)
	if err != nil {
		m.logger.Warn().Err(err).Str("action", c.Action).Msg("media control failed")
		return
	}
	state.By, state.Action = session.ID(), c.Action
	m.publish(state)
}

func (m *Manager) Start() error {
	m.sessions.OnConnected(func(session types.Session) {
		session.Send(MEDIA_INIT, Init{Enabled: m.config.Enabled})

		m.mu.Lock()
		last := m.last
		m.mu.Unlock()
		if m.config.Enabled && last.Found {
			last.By, last.Action = "", ""
			session.Send(MEDIA_STATE, last)
		}
	})

	if m.config.Enabled {
		ctx, cancel := context.WithCancel(context.Background())
		m.cancel = cancel
		m.wg.Add(1)
		go m.poll(ctx)
	}
	return nil
}

func (m *Manager) Shutdown() error {
	if m.cancel != nil {
		m.cancel()
	}
	m.wg.Wait()
	return nil
}

func (m *Manager) WebSocketHandler(session types.Session, msg types.WebSocketMessage) bool {
	if msg.Event != MEDIA_CONTROL {
		return false
	}

	var c Control
	if err := json.Unmarshal(msg.Payload, &c); err != nil {
		m.logger.Warn().Err(err).Msg("failed to unmarshal media control")
		return true
	}
	if !m.config.Enabled || !actions[c.Action] || !m.canControl(session) {
		return true
	}
	// a seek of ten minutes at most, either way
	c.Seconds = math.Max(-600, math.Min(600, c.Seconds))

	m.mu.Lock()
	now := time.Now()
	if now.Sub(m.controls[session.ID()]) < controlEvery {
		m.mu.Unlock()
		return true
	}
	m.controls[session.ID()] = now
	m.mu.Unlock()

	// the browser may take a moment: not on the member's websocket goroutine
	go m.control(session, c)
	return true
}
