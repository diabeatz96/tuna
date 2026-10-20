package media

import (
	"encoding/json"
	"fmt"
)

// probe is what the script reports about a target
type probe struct {
	Found    bool    `json:"found"`
	Visible  bool    `json:"visible"`
	Paused   bool    `json:"paused"`
	Time     float64 `json:"time"`
	Duration float64 `json:"duration"`
}

// actions a member may send
var actions = map[string]bool{"play": true, "pause": true, "toggle": true, "seek": true}

// script finds the target's largest loaded video, applies the action to it ("" only reads it) and
// reports it; play() resolves later, but `paused` changes at the call, so the report is current
func script(action string, seconds float64) string {
	a, _ := json.Marshal(action)
	return fmt.Sprintf(`(() => {
  const visible = document.visibilityState === 'visible'
  const area = (v) => { const r = v.getBoundingClientRect(); return r.width * r.height }
  const v = [...document.querySelectorAll('video')].filter((v) => v.readyState > 0).sort((a, b) => area(b) - area(a))[0]
  if (!v) return { found: false, visible }
  const action = %s, seconds = %g
  if (action === 'play' || (action === 'toggle' && v.paused)) v.play().catch(() => {})
  else if (action === 'pause' || action === 'toggle') v.pause()
  else if (action === 'seek' && isFinite(v.duration)) v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + seconds))
  return { found: true, visible, paused: v.paused, time: v.currentTime, duration: isFinite(v.duration) ? v.duration : 0 }
})()`, a, seconds)
}
