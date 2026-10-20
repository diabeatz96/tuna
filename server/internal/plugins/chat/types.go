package chat

import "time"

const PluginName = "chat"

const (
	CHAT_INIT    = "chat/init"
	CHAT_MESSAGE = "chat/message"
)

type Init struct {
	Enabled bool `json:"enabled"`
	// the recent messages, oldest first, for a member who just connected (chat.history)
	History []HistoryMessage `json:"history,omitempty"`
}

type Content struct {
	Text string `json:"text"`
}

type Message struct {
	ID      string    `json:"id"`
	Created time.Time `json:"created"`
	Content Content   `json:"content"`
}

// HistoryMessage is a Message with its sender's name when it was sent, since the sender may be gone
type HistoryMessage struct {
	Message
	Name string `json:"name"`
}
