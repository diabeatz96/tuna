package media

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestReadyRound(t *testing.T) {
	r := newReadyRound("a")
	v := r.view([]string{"a", "b", "c"})
	if fmt.Sprint(v.Ready, v.Waiting) != "[a] [b c]" || !v.Active || v.By != "a" {
		t.Fatalf("view = %+v", v)
	}
	if r.done([]string{"a", "b"}) {
		t.Fatal("done before b is ready")
	}
	r.ready["b"] = true
	if !r.done([]string{"a", "b"}) {
		t.Error("not done with everyone here ready")
	}
	// c joined: not done any more; c left again: done
	if r.done([]string{"a", "b", "c"}) || !r.done([]string{"b"}) {
		t.Error("done does not follow who is here")
	}
	if r.done(nil) {
		t.Error("done with nobody here")
	}
}

func TestPredictKeepsGuessesHiddenUntilRevealed(t *testing.T) {
	p := newPredictRound("r1", "Ep 1", "a")
	p.submit("a", "Alice", "  he wins  ")
	p.submit("b", "Bob", strings.Repeat("x", 300))

	alice := p.view("a")
	if alice.Mine != "he wins" || fmt.Sprint(alice.Names) != "[Alice Bob]" || alice.Entries != nil {
		t.Fatalf("alice sees %+v", alice)
	}
	if bob := p.view("b"); len([]rune(bob.Mine)) != maxPrediction || bob.Entries != nil {
		t.Fatalf("bob sees %+v", bob)
	}

	p.submit("b", "Bob", "") // taken back
	if fmt.Sprint(p.view("a").Names) != "[Alice]" {
		t.Fatalf("names = %v", p.view("a").Names)
	}

	p.revealed = true
	if p.submit("c", "Carol", "late") {
		t.Error("a guess after the reveal")
	}
	if got := p.view("c").Entries; len(got) != 1 || got[0] != (Prediction{Name: "Alice", Text: "he wins"}) {
		t.Errorf("revealed entries = %+v", got)
	}

	var none *predictRound
	if v := none.view("a"); v.ID != "" || v.Names == nil {
		t.Errorf("no round = %+v", v)
	}
}

func TestWatchingEntryUpdatesAndRatingPrompt(t *testing.T) {
	w := &watching{title: "Ep 1"}
	after := 5 * time.Minute
	playing := State{Found: true, Time: 100, Duration: 1400, Title: "Ep 1"}

	if create, _, _ := w.step(playing, 4*time.Minute, []string{"Alice"}, after); create {
		t.Fatal("created before five minutes")
	}
	if create, _, _ := w.step(State{Found: true, Paused: true, Duration: 1400}, 10*time.Minute, nil, after); create {
		t.Fatal("paused time counted")
	}
	create, _, _ := w.step(playing, time.Minute, []string{"Alice", "Bob"}, after)
	if !create || fmt.Sprint(w.attendees) != "[Alice Bob]" {
		t.Fatalf("create = %v, attendees = %v", create, w.attendees)
	}
	w.entryID = "e1"

	if _, update, _ := w.step(playing, time.Second, []string{"Alice"}, after); update {
		t.Error("updated with nothing new")
	}
	if _, update, _ := w.step(playing, time.Second, []string{"Carol"}, after); !update {
		t.Error("not updated for a new attendee")
	}

	end := State{Found: true, Paused: true, Time: 1350, Duration: 1400, Title: "Ep 1"}
	if _, _, ask := w.step(end, time.Second, nil, after); !ask {
		t.Error("no rating prompt near the end")
	}
	if _, _, ask := w.step(end, time.Second, nil, after); ask {
		t.Error("asked twice")
	}
}

func TestDiarySavesAndLoads(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "tuna")
	d, err := openDiary(dir)
	if err != nil {
		t.Fatal(err)
	}
	_ = d.add(DiaryEntry{ID: "1", Title: "Ep 1", Attendees: []string{"Alice"}})
	_ = d.add(DiaryEntry{ID: "2", Title: "Ep 2"})
	if _, ok, err := d.update("1", func(e *DiaryEntry) { e.Ratings["Alice"] = 5 }); !ok || err != nil {
		t.Fatal("update failed", err)
	}
	if _, ok, _ := d.update("nope", func(*DiaryEntry) {}); ok {
		t.Error("updated an entry that does not exist")
	}

	again, err := openDiary(dir)
	if err != nil {
		t.Fatal(err)
	}
	list := again.list()
	if len(list) != 2 || list[0].ID != "2" || list[1].Ratings["Alice"] != 5 {
		t.Fatalf("loaded %+v", list)
	}
	list[1].Attendees[0] = "changed" // a copy
	if again.list()[1].Attendees[0] != "Alice" {
		t.Error("list is not a copy")
	}
	if id, ok := again.latest("Ep 1"); !ok || id != "1" {
		t.Errorf("latest = %q %v", id, ok)
	}
	if ok, _ := again.remove("2"); !ok || len(again.list()) != 1 {
		t.Error("remove failed")
	}
	if _, err := os.Stat(filepath.Join(dir, "diary.json.tmp")); !os.IsNotExist(err) {
		t.Error("the temporary file is left behind")
	}

	mem, _ := openDiary("")
	_ = mem.add(DiaryEntry{ID: "x"})
	if len(mem.list()) != 1 {
		t.Error("the in-memory diary lost its entry")
	}
}
