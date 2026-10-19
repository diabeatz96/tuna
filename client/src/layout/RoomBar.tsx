import { Members } from '@/features/members/Members'
import { RoomMenu } from '@/features/room-menu/RoomMenu'
import { Controls } from '@/features/controls/Controls'
import { Emotes } from '@/features/emotes/Emotes'

// the bar under the video: the members, then the room menu, the controls and the emotes in three
// columns (a grid, so the columns stay when the emotes are hidden); on a phone a compact row, the
// three spread over the width and each showing less (no volume slider, no recent emotes); a phone
// on its side keeps only that row, without the members, so the video gets the height
export function RoomBar() {
  return (
    <div
      className="phone:h-auto phone:pb-1.5 short:h-auto short:py-1 flex h-controls max-w-full shrink-0 flex-col bg-background-tertiary"
      data-testid="room-bar"
    >
      <div className="short:hidden flex flex-1">
        <Members />
      </div>
      <div className="phone:flex phone:items-center phone:justify-between short:flex short:items-center short:justify-between grid max-w-full flex-1 grid-cols-3">
        <RoomMenu />
        <Controls />
        <Emotes />
      </div>
    </div>
  )
}
