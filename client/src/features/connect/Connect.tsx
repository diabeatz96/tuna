import { useEffect, useReducer, useState, type SyntheticEvent } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { actions } from '@/state/actions'
import type { NekoApp } from '@/state/app'
import { tell } from '@/state/dialogs'
import { useNeko } from '@/state/provider'
import { i18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Bubble, PixelCat, useBlink, useCycle, type Frame } from '@/components/tuna/PixelCat'
import logo from '@/assets/images/logo.svg'
import { BRAND } from '@/lib/brand'

const input =
  'my-[5px] rounded-[5px] border-0 bg-background-tertiary px-2 py-1.5 leading-5 text-text-normal selection:bg-text-link placeholder:text-[#757575]'

const params = new URL(location.href).searchParams
// ?pwd= invite (e.g. neko-rooms links): used for the first login attempt only, like the legacy
// client; after that the form asks for a password, so a stale invite is not a dead end
let invite = params.get('pwd')
const loginOnce = (neko: NekoApp, user: string, password: string) =>
  actions(neko)
    .login(user, password)
    .catch((err) => tell(neko.app, i18n.t('connect.error'), err.message))
    .finally(() => (invite = null))

// Tuna sitting on the box's top edge, saying hello
function PerchedTuna() {
  const { t } = useTranslation()
  const frame = useBlink(useCycle<Frame>(['sit', 'sit', 'sit_tail', 'sit', 'blep', 'sit'], 900))
  return (
    <span className="pointer-events-none absolute right-5 bottom-full -mb-[9px]" data-testid="connect-tuna">
      <PixelCat frame={frame} scale={2}>
        <Bubble right>{t('mascot.hello')}</Bubble>
      </PixelCat>
    </span>
  )
}

// connecting: Tuna on her way
function WalkingTuna() {
  const { t } = useTranslation()
  const frame = useCycle<Frame>(['walk_1', 'walk_2'], 200)
  return (
    <div className="flex flex-col items-center gap-2 py-2.5" data-testid="connect-walking">
      <PixelCat frame={frame} scale={3} />
      <span className="font-mono text-[12px] text-text-muted">{t('mascot.connecting')}</span>
    </div>
  )
}

// the login screen, and the "Connect" screen of a logged-in viewer without a connection
export function Connect() {
  const { t } = useTranslation()
  const neko = useNeko()
  const { client, app } = neko
  const { status, authenticated } = useStore(
    client.store,
    useShallow((s) => ({ status: s.connection.status, authenticated: s.authenticated })),
  )
  const [oauth, setOauth] = useState<{
    enabled?: boolean
    name?: string
    login_url?: string
    password_login_enabled?: boolean
  }>({})
  const [displayname, setDisplayname] = useState(params.get('usr') || '')
  const [password, setPassword] = useState('')
  // a login attempt that is over has used up the invite: show the form with the password field
  const [, settled] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    client.api
      .req<typeof oauth>('GET', '/oauth/config')
      .then(setOauth)
      .catch(() => {})
    // ?usr=&pwd= (e.g. neko-rooms links) log in straight away, then leave the URL
    if (invite !== null || params.has('usr') || params.has('token')) {
      const url = new URL(location.href)
      for (const k of ['pwd', 'usr', 'token']) url.searchParams.delete(k)
      history.replaceState(null, '', url)
    }
    // always, even if a saved session is being resumed at the same time: the link wins
    // (login() drops the resumed websocket), and this must not depend on which answer is first
    if (invite && params.get('usr')) loginOnce(neko, params.get('usr')!, invite).finally(settled)
  }, [neko, client])

  const login = (e: SyntheticEvent) => {
    e.preventDefault()
    if (!displayname) return tell(app, t('connect.error'), t('connect.empty_displayname'))
    loginOnce(neko, displayname, invite ?? password).finally(settled)
  }

  const connecting = status === 'connecting'
  const passwordLogin = oauth.password_login_enabled !== false
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background-floating/80" data-testid="connect">
      <div className="relative w-[320px] rounded-[5px] bg-background-secondary p-2.5">
        {!connecting && <PerchedTuna />}
        <div className="flex w-full cursor-pointer items-center justify-center">
          <img src={logo} alt={BRAND.name} className="mr-2.5 h-[90px]" />
          <span className="text-[30px] leading-14 font-black">{BRAND.name}</span>
        </div>
        {connecting ? (
          <WalkingTuna />
        ) : authenticated ? (
          // logged in but disconnected (network drop, server restart)
          <form className="flex flex-col" onSubmit={(e) => (e.preventDefault(), client.connect())}>
            <span className="block text-center leading-7.5 uppercase">{t('connection.disconnected')}</span>
            <Button className="my-[5px]" type="submit">
              {t('connect.connect')}
            </Button>
            <Button className="my-[5px]" type="button" onClick={actions(neko).logout}>
              {t('logout')}
            </Button>
          </form>
        ) : (
          <form className="flex flex-col" onSubmit={login}>
            <span className="block text-center leading-7.5 uppercase">
              {invite === null ? t('connect.login_title') : t('connect.invitation_title')}
            </span>
            {passwordLogin && (
              <input
                className={input}
                type="text"
                placeholder={t('connect.displayname')}
                value={displayname}
                onChange={(e) => setDisplayname(e.target.value)}
                autoFocus
              />
            )}
            {passwordLogin && invite === null && (
              <input
                className={input}
                type="password"
                placeholder={t('connect.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
            {passwordLogin && (
              <Button className="my-[5px]" type="submit">
                {t('connect.connect')}
              </Button>
            )}
            {oauth.enabled && invite === null && (
              <Button
                variant="outline"
                className="my-[5px]"
                type="button"
                onClick={() => oauth.login_url && location.assign(oauth.login_url)}
              >
                {oauth.name || 'OAuth'} Login
              </Button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
