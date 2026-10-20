package media

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

func TestChanged(t *testing.T) {
	at := time.Unix(1000, 0)
	playing := State{Found: true, Time: 100, Title: "Ep 1"}
	paused := State{Found: true, Paused: true, Time: 100, Title: "Ep 1"}
	tests := []struct {
		name  string
		last  State
		now   State
		after time.Duration
		want  bool
	}{
		{"nothing to nothing", State{}, State{}, time.Second, false},
		{"a video appears", State{}, playing, time.Second, true},
		{"paused", playing, State{Found: true, Paused: true, Time: 103, Title: "Ep 1"}, 3 * time.Second, true},
		{"playing on as expected", playing, State{Found: true, Time: 103, Title: "Ep 1"}, 3 * time.Second, false},
		{"a jump while playing", playing, State{Found: true, Time: 160, Title: "Ep 1"}, 3 * time.Second, true},
		{"still paused", paused, paused, 10 * time.Second, false},
		{"a jump while paused", paused, State{Found: true, Paused: true, Time: 300, Title: "Ep 1"}, time.Second, true},
		{"the next episode", playing, State{Found: true, Time: 0, Title: "Ep 2"}, time.Second, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := changed(tt.last, at, tt.now, at.Add(tt.after)); got != tt.want {
				t.Errorf("changed = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestScriptQuotesTheAction(t *testing.T) {
	s := script(`x'"); alert(1); ("`, 5)
	if !strings.Contains(s, `const action = "x'\"); alert(1); (\"", seconds = 5`) {
		t.Errorf("action not passed as a JSON string:\n%s", s)
	}
}

// a fake browser: /json/list with a hidden tab, a visible tab and a cross-site frame in the visible
// one that holds the video; every script run is recorded
func fakeBrowser(t *testing.T) (*httptest.Server, *[]string) {
	var runs []string
	upgrader := websocket.Upgrader{}
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ws := "ws" + strings.TrimPrefix(srv.URL, "http") + "/devtools/"
		if r.URL.Path == "/json/list" {
			_ = json.NewEncoder(w).Encode([]target{
				{ID: "hidden", Type: "page", Title: "Other tab", URL: "https://a.example/", WS: ws + "hidden"},
				{ID: "tab", Type: "page", Title: "Frieren - Episode 12", URL: "https://b.example/watch", WS: ws + "tab"},
				{ID: "frame", Type: "iframe", ParentID: "tab", URL: "https://player.example/", WS: ws + "frame"},
				{ID: "tools", Type: "page", URL: "devtools://devtools/", WS: ws + "tools"},
			})
			return
		}
		id := strings.TrimPrefix(r.URL.Path, "/devtools/")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()
		var req struct {
			ID     int `json:"id"`
			Params struct {
				Expression string `json:"expression"`
			} `json:"params"`
		}
		if err := conn.ReadJSON(&req); err != nil {
			return
		}
		runs = append(runs, id+":"+map[bool]string{true: "probe", false: "act"}[strings.Contains(req.Params.Expression, `const action = ""`)])
		p := probe{Visible: id != "hidden"}
		if id == "frame" {
			p.Found, p.Paused, p.Time, p.Duration = true, strings.Contains(req.Params.Expression, `"pause"`), 42, 1440
		}
		_ = conn.WriteJSON(map[string]any{"method": "Some.event"}) // events before the reply are skipped
		_ = conn.WriteJSON(map[string]any{"id": req.ID, "result": map[string]any{"result": map[string]any{"value": p}}})
	}))
	t.Cleanup(srv.Close)
	return srv, &runs
}

func TestReadFindsTheVideoInTheVisibleTabsFrame(t *testing.T) {
	srv, runs := fakeBrowser(t)
	m := &Manager{logger: zerolog.Nop(), devtools: newDevtools(srv.URL)}

	state, err := m.read(context.Background(), "pause", 0)
	if err != nil {
		t.Fatal(err)
	}
	want := State{Found: true, Paused: true, Time: 42, Duration: 1440, Title: "Frieren - Episode 12", Site: "b.example"}
	if state != want {
		t.Errorf("state = %+v, want %+v", state, want)
	}
	// every tab and frame read once, the devtools page never, the action run in the frame only
	if got := strings.Join(*runs, " "); got != "hidden:probe tab:probe frame:probe frame:act" {
		t.Errorf("runs = %s", got)
	}
}
