import {
  Building2,
  CalendarDays,
  Clock,
  Scissors,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { useOrganization } from '../organization/organization-context.ts'
import styles from './PanelLayout.module.css'

const links: { to: string; label: string; Icon: LucideIcon; end?: boolean }[] = [
  { to: '/painel', label: 'Agenda', Icon: CalendarDays, end: true },
  { to: '/painel/servicos', label: 'Serviços', Icon: Scissors },
  { to: '/painel/equipe', label: 'Equipe', Icon: UserCog },
  { to: '/painel/horarios', label: 'Horários', Icon: Clock },
  { to: '/painel/clientes', label: 'Clientes', Icon: Users },
  { to: '/painel/estabelecimento', label: 'Estabelecimento', Icon: Building2 },
]

export function PanelLayout() {
  const { organization } = useOrganization()
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)

  // No celular o menu vira uma faixa que rola para os lados: mantém a página
  // atual à vista (ex.: "Estabelecimento", o último item). Mexe só na faixa,
  // nunca na rolagem da página.
  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    const area = nav.getBoundingClientRect()
    const item = active.getBoundingClientRect()
    if (item.left < area.left || item.right > area.right) {
      // Centraliza o item na faixa.
      nav.scrollLeft += item.left - area.left - (area.width - item.width) / 2
    }
  }, [pathname])

  return (
    <div className={styles.layout}>
      <nav ref={navRef} className={styles.nav} aria-label="Painel">
        <p className={styles.orgName}>{organization.name}</p>
        <ul className={styles.list}>
          {links.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  isActive ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.content}>
        <Outlet />
      </div>
    </div>
  )
}
