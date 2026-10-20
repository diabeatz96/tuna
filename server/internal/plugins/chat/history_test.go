package chat

import (
	"fmt"
	"sync"
	"testing"
)

func msg(text string) HistoryMessage {
	return HistoryMessage{Message: Message{ID: "s1", Content: Content{Text: text}}, Name: "alice"}
}

func texts(list []HistoryMessage) []string {
	out := []string{}
	for _, m := range list {
		out = append(out, m.Content.Text)
	}
	return out
}

func TestHistoryKeepsTheLastMessagesOldestFirst(t *testing.T) {
	h := newHistory(3)
	if got := h.list(); got != nil {
		t.Fatalf("empty history = %v, want nil", got)
	}
	for _, text := range []string{"a", "b", "c", "d", "e"} {
		h.add(msg(text))
	}
	if got := fmt.Sprint(texts(h.list())); got != "[c d e]" {
		t.Errorf("history = %s, want [c d e]", got)
	}
}

func TestHistoryListIsACopy(t *testing.T) {
	h := newHistory(3)
	h.add(msg("a"))
	list := h.list()
	list[0].Content.Text = "changed"
	if got := h.list()[0].Content.Text; got != "a" {
		t.Errorf("history changed through its list: %q", got)
	}
}

func TestHistoryOffKeepsNothing(t *testing.T) {
	h := newHistory(0)
	h.add(msg("a"))
	if got := h.list(); got != nil {
		t.Errorf("history with limit 0 = %v, want nil", got)
	}
}

func TestHistoryConcurrentAdds(t *testing.T) {
	h := newHistory(50)
	var wg sync.WaitGroup
	for i := 0; i < 200; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			h.add(msg(fmt.Sprint(i)))
		}(i)
	}
	wg.Wait()
	if n := len(h.list()); n != 50 {
		t.Errorf("history has %d messages, want 50", n)
	}
}
