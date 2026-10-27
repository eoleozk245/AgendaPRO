import {
  Building2,
  CalendarDays,
  Clock,
  Scissors,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
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

  return (
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label="Painel">
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
