import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard, FolderKanban, ListTodo, MessageSquare,
  Users, Shield, GitBranch, Activity, Building2, Cpu,
  Globe, Check,
} from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useLocale } from '@/i18n/LocaleContext'
import type { Locale } from '@/i18n/index'

interface NavItem {
  id: string
  labelKey: string
  icon: React.ReactNode
  badge?: number
}

interface SideNavProps {
  activeItem?: string
  mobileOpen?: boolean
  onItemClick?: (itemId: string) => void
  onMobileClose?: () => void
}

const navItems: NavItem[] = [
  { id: 'dashboard',    labelKey: 'nav.dashboard',    icon: <LayoutDashboard size={16} /> },
  { id: 'projects',     labelKey: 'nav.projects',     icon: <FolderKanban size={16} /> },
  { id: 'work',         labelKey: 'nav.work',         icon: <ListTodo size={16} /> },
  { id: 'chat',         labelKey: 'nav.chat',         icon: <MessageSquare size={16} /> },
  { id: 'agents',       labelKey: 'nav.agents',       icon: <Users size={16} /> },
  { id: 'policies',     labelKey: 'nav.policies',     icon: <Shield size={16} /> },
  { id: 'integrations', labelKey: 'nav.integrations', icon: <GitBranch size={16} /> },
  { id: 'audit',        labelKey: 'nav.audit',        icon: <Activity size={16} /> },
  { id: 'office',       labelKey: 'nav.office',       icon: <Building2 size={16} /> },
  { id: 'game',         labelKey: 'nav.game',         icon: <span style={{ fontSize: 14 }}>🐱</span> },
]

const LANG_OPTIONS: { value: Locale; flag: string; label: string }[] = [
  { value: 'ru', flag: '🇷🇺', label: 'Русский' },
  { value: 'en', flag: '🇬🇧', label: 'English' },
]

function NavContent({
  activeItem,
  onItemClick,
}: {
  activeItem: string
  onItemClick: (id: string) => void
}) {
  const { t, locale, setLocale } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface-primary)' }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', height: 57, borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: 'var(--accent-muted)', border: '1px solid var(--accent-border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Cpu size={14} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          OpenClaw
        </span>
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 8, flex: 1, overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = activeItem === item.id
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', textAlign: 'left',
                height: 32, padding: '0 8px', borderRadius: 6,
                fontSize: 13, fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--surface-tertiary)' : 'transparent',
                border: 'none', cursor: 'pointer', transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--surface-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
            >
              <span style={{ color: isActive ? 'var(--accent-primary)' : 'inherit', flexShrink: 0 }}>
                {item.icon}
              </span>
              <span>{t(item.labelKey)}</span>
              {item.badge ? (
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, minWidth: 18, height: 18, padding: '0 5px', background: 'var(--accent-muted)', color: 'var(--accent-primary)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* Footer — Пятница + context menu */}
      <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border-default)', position: 'relative', flexShrink: 0 }} ref={menuRef}>

        {/* Context menu (opens above) */}
        {menuOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 8, right: 8,
            background: 'var(--surface-secondary)', border: '1px solid var(--border-default)',
            borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
            zIndex: 200,
          }}>
            {/* Language section */}
            <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Globe size={11} /> {t('sidenav.language')}
            </div>
            {LANG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setLocale(opt.value); setMenuOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', border: 'none', cursor: 'pointer',
                  background: locale === opt.value ? 'rgba(63,185,80,0.08)' : 'transparent',
                  color: locale === opt.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: 13, transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (locale !== opt.value) e.currentTarget.style.background = 'var(--surface-tertiary)' }}
                onMouseLeave={(e) => { if (locale !== opt.value) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16 }}>{opt.flag}</span>
                <span style={{ flex: 1 }}>{opt.label}</span>
                {locale === opt.value && <Check size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
              </button>
            ))}

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border-muted)', margin: '4px 0' }} />

            {/* Version info */}
            <div style={{ padding: '6px 12px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
              OpenClaw Virtual Office v1.0
            </div>
          </div>
        )}

        {/* Пятница button */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title="Настройки"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: menuOpen ? 'var(--surface-tertiary)' : 'var(--surface-secondary)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { if (!menuOpen) e.currentTarget.style.background = 'var(--surface-tertiary)' }}
          onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = 'var(--surface-secondary)' }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--accent-primary), #388bfd)',
            fontSize: 11, fontWeight: 700, color: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            П
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              Пятница
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {t('sidenav.role')}
            </div>
          </div>
          {/* Language flag indicator */}
          <span style={{ fontSize: 14, flexShrink: 0, opacity: 0.8 }}>
            {LANG_OPTIONS.find((o) => o.value === locale)?.flag}
          </span>
        </button>
      </div>
    </div>
  )
}

export function SideNav({ activeItem = 'dashboard', mobileOpen = false, onItemClick, onMobileClose }: SideNavProps) {
  const handleClick = (id: string) => {
    onItemClick?.(id)
    onMobileClose?.()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{
          width: 220,
          borderRight: '1px solid var(--border-default)',
          background: 'var(--surface-primary)',
        }}
      >
        <NavContent activeItem={activeItem} onItemClick={handleClick} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent
          side="left"
          className="p-0"
          style={{
            width: 220,
            background: 'var(--surface-primary)',
            border: 'none',
            borderRight: '1px solid var(--border-default)',
          }}
        >
          <NavContent activeItem={activeItem} onItemClick={handleClick} />
        </SheetContent>
      </Sheet>
    </>
  )
}
