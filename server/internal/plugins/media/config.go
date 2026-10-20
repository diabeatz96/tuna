package media

import (
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

type Config struct {
	Enabled bool
	// DevTools is the browser's remote debugging address, reachable only inside the container
	DevTools string
	// Poll is how often the video's state is read, to tell everyone about changes nobody sent
	Poll time.Duration
}

func (Config) Init(cmd *cobra.Command) error {
	cmd.PersistentFlags().Bool("media.enabled", true, "whether to enable the media plugin (room-wide play, pause and seek)")
	if err := viper.BindPFlag("media.enabled", cmd.PersistentFlags().Lookup("media.enabled")); err != nil {
		return err
	}

	cmd.PersistentFlags().String("media.devtools", "http://127.0.0.1:9222", "the browser's remote debugging address (--remote-debugging-port)")
	if err := viper.BindPFlag("media.devtools", cmd.PersistentFlags().Lookup("media.devtools")); err != nil {
		return err
	}

	cmd.PersistentFlags().Duration("media.poll", 3*time.Second, "how often the video's state is read")
	if err := viper.BindPFlag("media.poll", cmd.PersistentFlags().Lookup("media.poll")); err != nil {
		return err
	}

	return nil
}

func (s *Config) Set() {
	s.Enabled = viper.GetBool("media.enabled")
	s.DevTools = viper.GetString("media.devtools")
	s.Poll = viper.GetDuration("media.poll")
}
