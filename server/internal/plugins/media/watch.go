package media

import "time"

// a rating is asked for this close to the end
const rateBeforeEnd = 90 * time.Second

// watching follows what is playing now, to put it in the diary once it played long enough and to
// ask for ratings near its end
type watching struct {
	title, site string
	played      time.Duration
	attendees   []string // member names, in the order they were seen watching
	entryID     string   // its diary entry, once there is one
	asked       bool     // ratings were asked for
}

// step is one poll: the state read, the time since the last poll, the names of the members
// watching. It says whether to create the diary entry, to update it, and to ask for ratings.
func (w *watching) step(state State, dt time.Duration, watchers []string, after time.Duration) (create, update, ask bool) {
	// near the end, paused or not (a video stops at its end)
	if w.entryID != "" && !w.asked && state.Duration > 2*rateBeforeEnd.Seconds() &&
		state.Time >= state.Duration-rateBeforeEnd.Seconds() {
		w.asked, ask = true, true
	}
	if state.Paused {
		return
	}

	minutesBefore := int(w.played.Minutes())
	w.played += dt
	added := false
	for _, name := range watchers {
		if !contains(w.attendees, name) {
			w.attendees = append(w.attendees, name)
			added = true
		}
	}

	if w.entryID == "" {
		create = w.played >= after
		return
	}
	update = added || int(w.played.Minutes()) != minutesBefore
	return
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}
