package media

import "time"

const PluginName = "media"

const (
	// server -> client: whether the plugin is on, sent when a member connects
	MEDIA_INIT = "media/init"
	// server -> clients: the video on screen, after a member's control and whenever it changes
	MEDIA_STATE = "media/state"
	// client -> server: play, pause or seek the video on screen for everyone
	MEDIA_CONTROL = "media/control"

	// server -> clients: the ready check (Ready)
	MEDIA_READY = "media/ready"
	// client -> server: start a ready check, say ready or not ({ready}), call it off
	MEDIA_READY_START  = "media/ready/start"
	MEDIA_READY_SET    = "media/ready/set"
	MEDIA_READY_CANCEL = "media/ready/cancel"

	// server -> each client: the prediction round as that member may see it (Predict)
	MEDIA_PREDICT = "media/predict"
	// client -> server: open a round, send a guess ({text}), reveal the guesses, clear the round
	MEDIA_PREDICT_OPEN   = "media/predict/open"
	MEDIA_PREDICT_SUBMIT = "media/predict/submit"
	MEDIA_PREDICT_REVEAL = "media/predict/reveal"
	MEDIA_PREDICT_CLEAR  = "media/predict/clear"

	// server -> clients: a diary entry was added or changed (DiaryEntry)
	MEDIA_DIARY = "media/diary"
	// server -> clients: the episode is ending, rate it ({id, title})
	MEDIA_RATE = "media/rate"
	// client -> server: a member's stars for a diary entry ({id, stars})
	MEDIA_RATING = "media/rating"
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
	Site     string  `json:"site"`     // the tab's host name
	// the member who changed it and what they did, when it was a member's control
	By     string `json:"by,omitempty"`
	Action string `json:"action,omitempty"`
}

// Ready is the ready check: who started it, who is ready and who is not yet; when everyone is,
// Active turns false and GoAt (Unix milliseconds) is when the video plays
type Ready struct {
	Active  bool     `json:"active"`
	By      string   `json:"by,omitempty"`
	Ready   []string `json:"ready"`
	Waiting []string `json:"waiting"`
	GoAt    int64    `json:"go_at,omitempty"`
}

type Prediction struct {
	Name string `json:"name"`
	Text string `json:"text"`
}

// Predict is a prediction round as one member sees it: who has guessed, their own guess, and
// everyone's guesses once revealed; an empty ID means there is no round
type Predict struct {
	ID       string       `json:"id"`
	Title    string       `json:"title"`
	By       string       `json:"by"`
	Revealed bool         `json:"revealed"`
	Names    []string     `json:"names"`
	Mine     string       `json:"mine"`
	Entries  []Prediction `json:"entries,omitempty"`
}

// DiaryEntry is something the room watched for a while: when, how long, who, their stars (by
// member name, 1 to 5) and the round's predictions
type DiaryEntry struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Site        string         `json:"site"`
	Date        time.Time      `json:"date"`
	Minutes     int            `json:"minutes"`
	Attendees   []string       `json:"attendees"`
	Ratings     map[string]int `json:"ratings"`
	Predictions []Prediction   `json:"predictions,omitempty"`
	// only in a MEDIA_DIARY message: the entry was removed
	Deleted bool `json:"deleted,omitempty"`
}

type Rate struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type Rating struct {
	ID    string `json:"id"`
	Stars int    `json:"stars"`
}

type PredictText struct {
	Text string `json:"text"`
}

type ReadySet struct {
	Ready bool `json:"ready"`
}
