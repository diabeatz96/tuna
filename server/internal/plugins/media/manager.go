package media

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/m1k1o/neko/server/pkg/auth"
	"github.com/m1k1o/neko/server/pkg/types"
	"github.com/m1k1o/neko/server/pkg/utils"
)

// how far the video may be from where it should be before a poll calls it a seek
const driftSeconds = 4

// one member's controls at most this often
const controlEvery = 300 * time.Millisecond

// the ready check's countdown, and how long a ready check waits at most
const (
	countdown    = 3 * time.Second
	readyTimeout = 2 * time.Minute
)

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
// browser's DevTools, and tells the room what is playing. Around that, the room's watch party: the
// ready check, prediction rounds and the watch diary.
type Manager struct {
	logger   zerolog.Logger
	config   *Config
	sessions types.SessionManager
	devtools *devtools
	diary    *diary

	// sessions methods are never called with mu held: the session manager calls back into us
	mu         sync.Mutex
	last       State     // what was last told to the room
	lastAt     time.Time // when
	controls   map[string]time.Time
	ready      *readyRound
	readyTimer *time.Timer
	predict    *predictRound
	watch      *watching
	lastPoll   time.Time

	cancel context.CancelFunc
	wg     sync.WaitGroup
}

var errNoVideo = errors.New("no video in the visible tab")

func newID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func host(raw string) string {
	if u, err := url.Parse(raw); err == nil {
		return u.Hostname()
	}
	return ""
}

// read finds the video in the visible tab (or a cross-site frame in it), applies the action when there
// is one, and reports it with the tab's title and host
func (m *Manager) read(ctx context.Context, action string, seconds float64) (State, error) {
	targets, err := m.devtools.targets(ctx)
	if err != nil {
		return State{}, err
	}

	pages := map[string]target{}
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
			pages[t.ID] = t
			if p.Visible && visiblePage == "" {
				visiblePage = t.ID
			}
		}
		if p.Found && p.Visible && chosen == nil {
			chosen, found = &targets[i], p
		}
	}
	if chosen == nil {
		page := pages[visiblePage]
		return State{Title: page.Title, Site: host(page.URL)}, errNoVideo
	}

	if action != "" {
		if err := m.devtools.evaluate(ctx, *chosen, script(action, seconds), &found); err != nil {
			return State{}, err
		}
	}

	page, ok := pages[chosen.ID]
	if chosen.Type == "iframe" {
		if page, ok = pages[chosen.ParentID]; !ok {
			page = pages[visiblePage]
		}
	}
	return State{
		Found:    true,
		Paused:   found.Paused,
		Time:     found.Time,
		Duration: found.Duration,
		Title:    page.Title,
		Site:     host(page.URL),
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

// the members here: their session ids, and the names of those watching
func (m *Manager) present() (ids []string, watchers []string) {
	m.sessions.Range(func(s types.Session) bool {
		if s.State().IsConnected {
			ids = append(ids, s.ID())
			if s.State().IsWatching {
				watchers = append(watchers, s.Profile().Name)
			}
		}
		return true
	})
	return
}

func (m *Manager) connected() []types.Session {
	var out []types.Session
	m.sessions.Range(func(s types.Session) bool {
		if s.State().IsConnected {
			out = append(out, s)
		}
		return true
	})
	return out
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
		ids, watchers := m.present()
		if len(ids) == 0 {
			m.mu.Lock()
			m.lastPoll = time.Time{}
			m.mu.Unlock()
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
		m.track(state, watchers)
	}
}

// track follows what plays for the diary: an entry once it played DiaryAfter, its minutes and who
// watched, and the ratings asked for near its end or when something else starts
func (m *Manager) track(state State, watchers []string) {
	now := time.Now()
	var asks []Rate
	var create *DiaryEntry
	var updateID string
	var update func(*DiaryEntry)

	m.mu.Lock()
	dt := time.Duration(0)
	if !m.lastPoll.IsZero() {
		dt = now.Sub(m.lastPoll)
	}
	m.lastPoll = now
	if state.Found && state.Title != "" {
		if w := m.watch; w == nil || w.title != state.Title {
			// something else plays: rate what played before, if nobody was asked yet
			if w != nil && w.entryID != "" && !w.asked {
				asks = append(asks, Rate{ID: w.entryID, Title: w.title})
			}
			m.watch = &watching{title: state.Title, site: state.Site}
		}
		w := m.watch
		doCreate, doUpdate, ask := w.step(state, dt, watchers, m.config.DiaryAfter)
		if doCreate {
			w.entryID = newID()
			create = &DiaryEntry{
				ID: w.entryID, Title: w.title, Site: w.site, Date: now,
				Minutes: int(w.played.Minutes()), Attendees: append([]string{}, w.attendees...),
			}
		} else if doUpdate {
			minutes, attendees := int(w.played.Minutes()), append([]string{}, w.attendees...)
			updateID = w.entryID
			update = func(e *DiaryEntry) { e.Minutes, e.Attendees = minutes, attendees }
		}
		if ask {
			asks = append(asks, Rate{ID: w.entryID, Title: w.title})
		}
	}
	m.mu.Unlock()

	if create != nil {
		if err := m.diary.add(*create); err != nil {
			m.logger.Warn().Err(err).Msg("could not save the diary")
		}
		m.sessions.Broadcast(MEDIA_DIARY, *create)
	}
	if update != nil {
		if e, ok, err := m.diary.update(updateID, update); ok {
			if err != nil {
				m.logger.Warn().Err(err).Msg("could not save the diary")
			}
			m.sessions.Broadcast(MEDIA_DIARY, e)
		}
	}
	for _, r := range asks {
		m.sessions.Broadcast(MEDIA_RATE, r)
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

// the ready check, to everyone
func (m *Manager) sendReady() {
	ids, _ := m.present()
	m.mu.Lock()
	view := Ready{Ready: []string{}, Waiting: []string{}}
	if m.ready != nil {
		view = m.ready.view(ids)
	}
	m.mu.Unlock()
	m.sessions.Broadcast(MEDIA_READY, view)
}

// go: when everyone here is ready, the countdown, then play for everyone
func (m *Manager) maybeGo() {
	ids, _ := m.present()
	m.mu.Lock()
	if m.ready == nil || !m.ready.done(ids) {
		m.mu.Unlock()
		return
	}
	by := m.ready.by
	m.ready = nil
	if m.readyTimer != nil {
		m.readyTimer.Stop()
	}
	m.mu.Unlock()

	at := time.Now().Add(countdown)
	m.sessions.Broadcast(MEDIA_READY, Ready{Ready: []string{}, Waiting: []string{}, GoAt: at.UnixMilli()})
	time.AfterFunc(countdown, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
		defer cancel()
		state, err := m.read(ctx, "play", 0)
		if err != nil {
			m.logger.Warn().Err(err).Msg("ready check: could not play")
			return
		}
		state.By, state.Action = by, "play"
		m.publish(state)
	})
}

func (m *Manager) readyStart(session types.Session) {
	if !m.canControl(session) {
		return
	}
	m.mu.Lock()
	m.ready = newReadyRound(session.ID())
	if m.readyTimer != nil {
		m.readyTimer.Stop()
	}
	round := m.ready
	m.readyTimer = time.AfterFunc(readyTimeout, func() {
		m.mu.Lock()
		stale := m.ready == round
		if stale {
			m.ready = nil
		}
		m.mu.Unlock()
		if stale {
			m.sendReady()
		}
	})
	m.mu.Unlock()
	m.sendReady()
	m.maybeGo()
}

func (m *Manager) readySet(session types.Session, ready bool) {
	m.mu.Lock()
	if m.ready == nil {
		m.mu.Unlock()
		return
	}
	m.ready.ready[session.ID()] = ready
	m.mu.Unlock()
	m.sendReady()
	m.maybeGo()
}

func (m *Manager) readyCancel(session types.Session) {
	m.mu.Lock()
	if m.ready == nil || (m.ready.by != session.ID() && !session.Profile().IsAdmin) {
		m.mu.Unlock()
		return
	}
	m.ready = nil
	if m.readyTimer != nil {
		m.readyTimer.Stop()
	}
	m.mu.Unlock()
	m.sendReady()
}

// the prediction round, to each member as they may see it
func (m *Manager) sendPredict() {
	sessions := m.connected()
	m.mu.Lock()
	views := make([]Predict, len(sessions))
	for i, s := range sessions {
		views[i] = m.predict.view(s.ID())
	}
	m.mu.Unlock()
	for i, s := range sessions {
		s.Send(MEDIA_PREDICT, views[i])
	}
}

func (m *Manager) predictOpen(session types.Session) {
	m.mu.Lock()
	title := m.last.Title
	if m.watch != nil {
		title = m.watch.title
	}
	m.predict = newPredictRound(newID(), title, session.ID())
	m.mu.Unlock()
	m.sendPredict()
}

func (m *Manager) predictSubmit(session types.Session, text string) {
	m.mu.Lock()
	ok := m.predict != nil && m.predict.submit(session.ID(), session.Profile().Name, text)
	m.mu.Unlock()
	if ok {
		m.sendPredict()
	}
}

// reveal: everyone sees the guesses, and they go into the diary entry of what plays (or of the
// newest entry with the round's title)
func (m *Manager) predictReveal(session types.Session) {
	m.mu.Lock()
	p := m.predict
	if p == nil || p.revealed || (p.by != session.ID() && !session.Profile().IsAdmin) {
		m.mu.Unlock()
		return
	}
	p.revealed = true
	entries, title := p.list(), p.title
	entryID := ""
	if m.watch != nil && m.watch.title == title {
		entryID = m.watch.entryID
	}
	m.mu.Unlock()

	m.sendPredict()
	if entryID == "" {
		entryID, _ = m.diary.latest(title)
	}
	if entryID != "" && len(entries) > 0 {
		if e, ok, err := m.diary.update(entryID, func(e *DiaryEntry) { e.Predictions = entries }); ok {
			if err != nil {
				m.logger.Warn().Err(err).Msg("could not save the diary")
			}
			m.sessions.Broadcast(MEDIA_DIARY, e)
		}
	}
}

func (m *Manager) predictClear(session types.Session) {
	m.mu.Lock()
	if m.predict == nil || (m.predict.by != session.ID() && !session.Profile().IsAdmin) {
		m.mu.Unlock()
		return
	}
	m.predict = nil
	m.mu.Unlock()
	m.sendPredict()
}

func (m *Manager) rate(session types.Session, r Rating) {
	if r.Stars < 1 || r.Stars > 5 {
		return
	}
	name := session.Profile().Name
	e, ok, err := m.diary.update(r.ID, func(e *DiaryEntry) {
		if e.Ratings == nil {
			e.Ratings = map[string]int{}
		}
		e.Ratings[name] = r.Stars
	})
	if !ok {
		return
	}
	if err != nil {
		m.logger.Warn().Err(err).Msg("could not save the diary")
	}
	m.sessions.Broadcast(MEDIA_DIARY, e)
}

func (m *Manager) Route(r types.Router) {
	r.Get("/diary", func(w http.ResponseWriter, r *http.Request) error {
		return utils.HttpSuccess(w, m.diary.list())
	})
	r.With(auth.AdminsOnly).Delete("/diary/{id}", func(w http.ResponseWriter, r *http.Request) error {
		id := chi.URLParam(r, "id")
		ok, err := m.diary.remove(id)
		if !ok {
			return utils.HttpNotFound("no such diary entry")
		}
		if err != nil {
			m.logger.Warn().Err(err).Msg("could not save the diary")
		}
		m.sessions.Broadcast(MEDIA_DIARY, DiaryEntry{ID: id, Deleted: true})
		return utils.HttpSuccess(w)
	})
}

func (m *Manager) Start() error {
	var err error
	if m.diary, err = openDiary(m.config.DataDir); err != nil {
		m.logger.Warn().Err(err).Str("dir", m.config.DataDir).Msg("the watch diary is kept in memory only")
	}

	m.sessions.OnConnected(func(session types.Session) {
		session.Send(MEDIA_INIT, Init{Enabled: m.config.Enabled})
		if !m.config.Enabled {
			return
		}
		m.mu.Lock()
		last := m.last
		predict := m.predict.view(session.ID())
		m.mu.Unlock()
		if last.Found {
			last.By, last.Action = "", ""
			session.Send(MEDIA_STATE, last)
		}
		session.Send(MEDIA_PREDICT, predict)
		// the ready check's lists change with who is here; the callback must not wait on us
		go m.sendReady()
	})
	m.sessions.OnDisconnected(func(session types.Session) {
		if !m.config.Enabled {
			return
		}
		go func() {
			m.sendReady()
			m.maybeGo()
		}()
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

func decode[T any](msg types.WebSocketMessage) (T, bool) {
	var v T
	if len(msg.Payload) == 0 {
		return v, true
	}
	return v, json.Unmarshal(msg.Payload, &v) == nil
}

func (m *Manager) WebSocketHandler(session types.Session, msg types.WebSocketMessage) bool {
	switch msg.Event {
	case MEDIA_CONTROL, MEDIA_READY_START, MEDIA_READY_SET, MEDIA_READY_CANCEL,
		MEDIA_PREDICT_OPEN, MEDIA_PREDICT_SUBMIT, MEDIA_PREDICT_REVEAL, MEDIA_PREDICT_CLEAR, MEDIA_RATING:
	default:
		return false
	}
	if !m.config.Enabled {
		return true
	}

	// one member's messages at most every controlEvery; the browser may take a moment, so the work
	// is not done on the member's websocket goroutine
	m.mu.Lock()
	now := time.Now()
	if now.Sub(m.controls[session.ID()]) < controlEvery {
		m.mu.Unlock()
		return true
	}
	m.controls[session.ID()] = now
	m.mu.Unlock()

	switch msg.Event {
	case MEDIA_CONTROL:
		c, ok := decode[Control](msg)
		if !ok || !actions[c.Action] || !m.canControl(session) {
			return true
		}
		// a seek of ten minutes at most, either way
		c.Seconds = math.Max(-600, math.Min(600, c.Seconds))
		go m.control(session, c)
	case MEDIA_READY_START:
		go m.readyStart(session)
	case MEDIA_READY_SET:
		if s, ok := decode[ReadySet](msg); ok {
			go m.readySet(session, s.Ready)
		}
	case MEDIA_READY_CANCEL:
		go m.readyCancel(session)
	case MEDIA_PREDICT_OPEN:
		go m.predictOpen(session)
	case MEDIA_PREDICT_SUBMIT:
		if p, ok := decode[PredictText](msg); ok {
			go m.predictSubmit(session, p.Text)
		}
	case MEDIA_PREDICT_REVEAL:
		go m.predictReveal(session)
	case MEDIA_PREDICT_CLEAR:
		go m.predictClear(session)
	case MEDIA_RATING:
		if r, ok := decode[Rating](msg); ok {
			go m.rate(session, r)
		}
	}
	return true
}
