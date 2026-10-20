package media

const PluginName = "media"

const (
	// server -> client: whether the plugin is on, sent when a member connects
	MEDIA_INIT = "media/init"
	// server -> clients: the video on screen, after a member's control and whenever it changes
	MEDIA_STATE = "media/state"
	// client -> server: play, pause or seek the video on screen for everyone
	MEDIA_CONTROL = "media/control"
)

type Init struct {
	Enabled bool `json:"enabled"`
}

// Control is a member's command: "play", "pause", "toggle", or "seek" by Seconds (negative: back)
type Control struct {
	Action  string  `json:"action"`
	Seconds float64 `json:"seconds,omitempty"`
}

// State is the video playing in the browser's visible tab
type State struct {
	Found    bool    `json:"found"`
	Paused   bool    `json:"paused"`
	Time     float64 `json:"time"`
	Duration float64 `json:"duration"` // 0 for a live stream
	Title    string  `json:"title"`    // the tab's title
	// the member who changed it and what they did, when it was a member's control
	By     string `json:"by,omitempty"`
	Action string `json:"action,omitempty"`
}
