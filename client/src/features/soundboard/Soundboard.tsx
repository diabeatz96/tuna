import { useStore } from 'zustand'
import { useTranslation } from 'react-i18next'
import { MegaphoneIcon } from '@phosphor-icons/react'
import { selectMuted } from '@/state/app'
import { useClient, useNeko } from '@/state/provider'
import { SOUND_ICON, SOUNDS } from '@/state/sound'
import { sendSound } from '@/state/soundboard'
import { IconButton } from '@/components/IconButton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// the soundboard in the room bar, left of the emotes: a sound for the whole room
export function Soundboard() {
  const { t } = useTranslation()
  const neko = useNeko()
  const muted = useStore(useClient().store, selectMuted)
  if (muted) return null
  return (
    <div className="mx-[5px] self-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton label={t('sounds.title')} data-testid="sounds-open">
            <MegaphoneIcon className="size-6" />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-[190px]" data-testid="sounds-menu">
          {SOUNDS.map((s) => (
            <DropdownMenuItem
              key={s}
              className="flex items-center gap-2.5"
              data-sound={s}
              // the menu stays open, for another sound
              onSelect={(e) => (e.preventDefault(), sendSound(neko, s))}
            >
              <span className="text-[18px] leading-none">{SOUND_ICON[s]}</span>
              <span>{t(`sounds.${s}`)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
