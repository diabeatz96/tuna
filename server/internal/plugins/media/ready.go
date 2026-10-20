package media

// readyRound is a ready check in progress: who started it and who said they are ready; whoever
// starts it is ready
type readyRound struct {
	by    string
	ready map[string]bool
}

func newReadyRound(by string) *readyRound {
	return &readyRound{by: by, ready: map[string]bool{by: true}}
}

// view: who is ready and who is not yet, among the members here (session ids, in the given order)
func (r *readyRound) view(connected []string) Ready {
	v := Ready{Active: true, By: r.by, Ready: []string{}, Waiting: []string{}}
	for _, id := range connected {
		if r.ready[id] {
			v.Ready = append(v.Ready, id)
		} else {
			v.Waiting = append(v.Waiting, id)
		}
	}
	return v
}

// done: everyone here is ready, and someone is here
func (r *readyRound) done(connected []string) bool {
	v := r.view(connected)
	return len(v.Waiting) == 0 && len(v.Ready) > 0
}
