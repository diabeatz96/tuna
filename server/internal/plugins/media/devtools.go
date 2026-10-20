package media

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

// target is one of the browser's DevTools targets: a tab ("page") or a cross-site frame in one ("iframe")
type target struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	ParentID string `json:"parentId"`
	WS       string `json:"webSocketDebuggerUrl"`
}

// devtools talks to the browser over the Chrome DevTools Protocol: the HTTP list of its targets, and a
// short WebSocket connection per script run in one of them
type devtools struct {
	base   string
	client *http.Client
	dialer *websocket.Dialer
}

func newDevtools(base string) *devtools {
	return &devtools{
		base:   strings.TrimRight(base, "/"),
		client: &http.Client{Timeout: 2 * time.Second},
		dialer: &websocket.Dialer{HandshakeTimeout: 2 * time.Second},
	}
}

// the tabs and the cross-site frames in them; not the browser's own pages (devtools://, extensions)
func (d *devtools) targets(ctx context.Context) ([]target, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, d.base+"/json/list", nil)
	if err != nil {
		return nil, err
	}
	res, err := d.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("devtools: %s", res.Status)
	}

	var all []target
	if err := json.NewDecoder(res.Body).Decode(&all); err != nil {
		return nil, err
	}
	var out []target
	for _, t := range all {
		if (t.Type == "page" || t.Type == "iframe") && t.WS != "" &&
			!strings.HasPrefix(t.URL, "devtools://") && !strings.HasPrefix(t.URL, "chrome-extension://") {
			out = append(out, t)
		}
	}
	return out, nil
}

// evaluate runs a script in a target as a user gesture (so play() is allowed) and decodes its result
func (d *devtools) evaluate(ctx context.Context, t target, script string, result any) error {
	conn, _, err := d.dialer.DialContext(ctx, t.WS, nil)
	if err != nil {
		return err
	}
	defer conn.Close()
	if deadline, ok := ctx.Deadline(); ok {
		_ = conn.SetReadDeadline(deadline)
		_ = conn.SetWriteDeadline(deadline)
	}

	err = conn.WriteJSON(map[string]any{
		"id":     1,
		"method": "Runtime.evaluate",
		"params": map[string]any{
			"expression":    script,
			"returnByValue": true,
			"userGesture":   true,
		},
	})
	if err != nil {
		return err
	}

	// the reply to id 1; events the target sends meanwhile are skipped
	for {
		var msg struct {
			ID     int `json:"id"`
			Result struct {
				Result struct {
					Value json.RawMessage `json:"value"`
				} `json:"result"`
				Exception *struct {
					Text string `json:"text"`
				} `json:"exceptionDetails"`
			} `json:"result"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := conn.ReadJSON(&msg); err != nil {
			return err
		}
		if msg.ID != 1 {
			continue
		}
		if msg.Error != nil {
			return errors.New(msg.Error.Message)
		}
		if msg.Result.Exception != nil {
			return fmt.Errorf("script: %s", msg.Result.Exception.Text)
		}
		return json.Unmarshal(msg.Result.Result.Value, result)
	}
}
