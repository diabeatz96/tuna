package chat

import "sync"

// history keeps the last `limit` messages, oldest first, for members who connect later; in memory,
// so a restart clears it
type history struct {
	mu       sync.Mutex
	limit    int
	messages []HistoryMessage
}

func newHistory(limit int) *history {
	return &history{limit: limit}
}

func (h *history) add(msg HistoryMessage) {
	if h.limit <= 0 {
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	h.messages = append(h.messages, msg)
	if over := len(h.messages) - h.limit; over > 0 {
		// copy, so the dropped messages are not kept alive by the backing array
		h.messages = append([]HistoryMessage(nil), h.messages[over:]...)
	}
}

// a copy of the messages, oldest first; nil when there are none
func (h *history) list() []HistoryMessage {
	h.mu.Lock()
	defer h.mu.Unlock()

	if len(h.messages) == 0 {
		return nil
	}
	return append([]HistoryMessage(nil), h.messages...)
}
