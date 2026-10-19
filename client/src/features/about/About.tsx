import { useTranslation } from 'react-i18next'
import { BookIcon, GithubLogoIcon } from '@phosphor-icons/react'
import { useApp } from '@/state/provider'
import { Dialog, DialogPortal, DialogOverlay, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import logo from '@/assets/images/logo.svg'
import { BRAND } from '@/lib/brand'

export function About() {
  const { t } = useTranslation()
  const app = useApp()
  const close = () => app.setState({ about: false })
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogPortal>
        <DialogOverlay className="bg-background-floating/80" />
        <DialogContent
          className="max-h-[70vh] max-w-[70vw] overflow-x-hidden overflow-y-auto rounded-[5px] bg-background-secondary [scrollbar-color:var(--color-background-tertiary)_transparent] [scrollbar-width:thin]"
          aria-describedby={undefined}
          data-testid="about"
        >
          <DialogTitle className="sr-only">About {BRAND.name}</DialogTitle>
          <div className="px-10 py-7.5 text-center text-interactive-normal">
            <div className="mb-[15px] flex items-center justify-center">
              <img src={logo} alt={BRAND.name} className="mr-2.5 h-[70px]" />
              <span className="text-[30px] leading-14 font-bold">{BRAND.name}</span>
            </div>
            <p className="mb-[15px]">{BRAND.tagline}</p>
            <p className="mb-[15px] text-[13px] text-text-muted">
              Based on{' '}
              <a className="text-text-link" href={BRAND.upstreamUrl} target="_blank" rel="noopener noreferrer">
                {BRAND.upstreamName}
              </a>{' '}
              by m1k1o.
            </p>
            <p className="mb-[15px]">
              <a className="mx-2.5 text-text-link" href={BRAND.repoUrl} target="_blank" rel="noopener noreferrer">
                <GithubLogoIcon className="inline size-3.5 align-[-0.125em]" /> {BRAND.repo}
              </a>
              <a className="mx-2.5 text-text-link" href={BRAND.docsUrl} target="_blank" rel="noopener noreferrer">
                <BookIcon className="inline size-3.5 align-[-0.125em]" /> Documentation
              </a>
            </p>
            <p className="mb-[15px] text-[12px] text-text-muted">client {__APP_VERSION__}</p>
            <Button
              className="px-6 py-2 leading-none font-normal text-white normal-case"
              data-testid="about-close"
              onClick={close}
            >
              {t('connection.button_confirm')}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
