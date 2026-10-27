import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from './components/EmptyState.tsx'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <EmptyState
        pageTitle
        icon={SearchX}
        title="Página não encontrada"
        description="O endereço pode estar errado ou a página não existe mais."
        action={<Link to="/">Voltar para o início</Link>}
      />
    </div>
  )
}
