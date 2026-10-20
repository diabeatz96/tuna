package media

import (
	"strings"
	"unicode/utf8"
)

// the longest guess, in characters
const maxPrediction = 200

// predictRound is a prediction round: each member's guess, hidden from the others until revealed
type predictRound struct {
	id, title, by string
	revealed      bool
	entries       map[string]Prediction // by session id
	order         []string              // session ids, in the order they first guessed
}

func newPredictRound(id, title, by string) *predictRound {
	return &predictRound{id: id, title: title, by: by, entries: map[string]Prediction{}}
}

// submit sets a member's guess (an empty one takes it back); not once revealed
func (p *predictRound) submit(session, name, text string) bool {
	if p.revealed {
		return false
	}
	text = strings.TrimSpace(text)
	if utf8.RuneCountInString(text) > maxPrediction {
		text = string([]rune(text)[:maxPrediction])
	}
	if text == "" {
		if _, ok := p.entries[session]; !ok {
			return false
		}
		delete(p.entries, session)
		for i, id := range p.order {
			if id == session {
				p.order = append(p.order[:i], p.order[i+1:]...)
				break
			}
		}
		return true
	}
	if _, ok := p.entries[session]; !ok {
		p.order = append(p.order, session)
	}
	p.entries[session] = Prediction{Name: name, Text: text}
	return true
}

// list: the guesses, in the order they came
func (p *predictRound) list() []Prediction {
	out := []Prediction{}
	for _, id := range p.order {
		out = append(out, p.entries[id])
	}
	return out
}

// view: the round as one member may see it; the others' guesses only once revealed
func (p *predictRound) view(session string) Predict {
	if p == nil {
		return Predict{Names: []string{}}
	}
	v := Predict{ID: p.id, Title: p.title, By: p.by, Revealed: p.revealed, Names: []string{}, Mine: p.entries[session].Text}
	for _, id := range p.order {
		v.Names = append(v.Names, p.entries[id].Name)
	}
	if p.revealed {
		v.Entries = p.list()
	}
	return v
}
