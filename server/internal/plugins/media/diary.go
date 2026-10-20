package media

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// the most entries kept; the oldest go first
const diaryLimit = 1000

// diary is the watch diary, kept in <data_dir>/diary.json and saved on every change (written to a
// temporary file, then renamed over the old one); without a file it lives in memory only
type diary struct {
	mu      sync.Mutex
	path    string
	entries []DiaryEntry // oldest first
}

func openDiary(dir string) (*diary, error) {
	d := &diary{}
	if dir == "" {
		return d, nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return d, err
	}
	d.path = filepath.Join(dir, "diary.json")
	data, err := os.ReadFile(d.path)
	if errors.Is(err, os.ErrNotExist) {
		return d, nil
	}
	if err != nil {
		return d, err
	}
	if err := json.Unmarshal(data, &d.entries); err != nil {
		return d, err
	}
	return d, nil
}

func clone(e DiaryEntry) DiaryEntry {
	e.Attendees = append([]string{}, e.Attendees...)
	ratings := map[string]int{}
	for k, v := range e.Ratings {
		ratings[k] = v
	}
	e.Ratings = ratings
	e.Predictions = append([]Prediction(nil), e.Predictions...)
	return e
}

// list: copies of the entries, newest first
func (d *diary) list() []DiaryEntry {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := make([]DiaryEntry, 0, len(d.entries))
	for i := len(d.entries) - 1; i >= 0; i-- {
		out = append(out, clone(d.entries[i]))
	}
	return out
}

func (d *diary) add(e DiaryEntry) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if e.Ratings == nil {
		e.Ratings = map[string]int{}
	}
	d.entries = append(d.entries, clone(e))
	if over := len(d.entries) - diaryLimit; over > 0 {
		d.entries = append([]DiaryEntry(nil), d.entries[over:]...)
	}
	return d.save()
}

// update changes an entry and returns a copy of it; false when there is no such entry
func (d *diary) update(id string, change func(*DiaryEntry)) (DiaryEntry, bool, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	for i := range d.entries {
		if d.entries[i].ID == id {
			change(&d.entries[i])
			return clone(d.entries[i]), true, d.save()
		}
	}
	return DiaryEntry{}, false, nil
}

// latest: the newest entry with this title
func (d *diary) latest(title string) (string, bool) {
	d.mu.Lock()
	defer d.mu.Unlock()
	for i := len(d.entries) - 1; i >= 0; i-- {
		if d.entries[i].Title == title {
			return d.entries[i].ID, true
		}
	}
	return "", false
}

func (d *diary) remove(id string) (bool, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	for i := range d.entries {
		if d.entries[i].ID == id {
			d.entries = append(d.entries[:i], d.entries[i+1:]...)
			return true, d.save()
		}
	}
	return false, nil
}

// save writes the entries; with the lock held
func (d *diary) save() error {
	if d.path == "" {
		return nil
	}
	data, err := json.MarshalIndent(d.entries, "", "  ")
	if err != nil {
		return err
	}
	tmp := d.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, d.path)
}
