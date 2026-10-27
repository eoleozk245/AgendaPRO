import { Check, Pencil, Plus, Trash2, UserCog, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Badge } from '../../components/Badge.tsx'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import table from '../../components/Table.module.css'
import type { Service } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useOrganization } from '../organization/organization-context.ts'
import { deleteProfessional, loadTeam, type TeamMember } from './api.ts'
import { ProfessionalFormModal } from './ProfessionalFormModal.tsx'
import styles from './TeamPage.module.css'

type Editing = { mode: 'new' } | { mode: 'edit'; professional: TeamMember } | null

function serviceNames(professional: TeamMember, services: Service[]): string {
  const names = services.filter((s) => professional.serviceIds.includes(s.id)).map((s) => s.name)
  return names.length > 0 ? names.join(', ') : 'Nenhum serviço'
}

export function TeamPage() {
  const { organization } = useOrganization()
  const load = useCallback(() => loadTeam(organization.id), [organization.id])
  const { state, reload, retry } = useAsyncData(load)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<TeamMember | null>(null)

  const newButton = (
    <Button icon={<Plus size={18} />} onClick={() => setEditing({ mode: 'new' })}>
      Novo profissional
    </Button>
  )
  const data = state.status === 'ready' ? state.data : undefined

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Quem atende e quais serviços cada pessoa faz."
        action={data && data.professionals.length > 0 ? newButton : undefined}
      />

      {state.status === 'loading' && <LoadingState label="Carregando a equipe" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível carregar a equipe.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {data && data.professionals.length === 0 && (
        <EmptyState
          icon={UserCog}
          title="Nenhum profissional cadastrado"
          description="Sem profissional, a agenda e a página de agendamento ficam sem horários."
          action={newButton}
        />
      )}
      {data && data.professionals.length > 0 && (
        <div className={styles.content}>
          {!data.professionals.some((p) => p.active) && (
            <Alert tone="warning" title="Nenhum profissional ativo">
              A página de agendamento fica sem horários até alguém ser ativado.
            </Alert>
          )}
          <div className={table.wrapper}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th scope="col">Profissional</th>
                  <th scope="col">Serviços</th>
                  <th scope="col">Situação</th>
                  <th scope="col">
                    <span className="visually-hidden">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.professionals.map((professional) => (
                  <tr key={professional.id}>
                    <td>{professional.name}</td>
                    <td data-label="Serviços">{serviceNames(professional, data.services)}</td>
                    <td data-label="Situação">
                      {professional.active ? (
                        <Badge tone="success" icon={<Check size={14} />}>
                          Ativo
                        </Badge>
                      ) : (
                        <Badge tone="neutral" icon={<X size={14} />}>
                          Inativo
                        </Badge>
                      )}
                    </td>
                    <td>
                      <div className={table.actions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Editar ${professional.name}`}
                          onClick={() => setEditing({ mode: 'edit', professional })}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Excluir ${professional.name}`}
                          onClick={() => setDeleting(professional)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && data && (
        <ProfessionalFormModal
          organizationId={organization.id}
          professional={editing.mode === 'edit' ? editing.professional : undefined}
          services={data.services}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Excluir profissional"
          confirmLabel="Excluir"
          errorMessage={errorText}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteProfessional(deleting.id)
            setDeleting(null)
            reload()
          }}
        >
          <p>
            Excluir <strong>{deleting.name}</strong>? Essa ação não pode ser desfeita. Se a pessoa
            só parou de atender, edite e desmarque “Ativo”: o histórico fica guardado.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
