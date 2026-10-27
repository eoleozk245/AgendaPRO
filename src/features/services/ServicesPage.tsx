import { Check, Pencil, Plus, Scissors, Trash2, X } from 'lucide-react'
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
import { formatDuration } from '../../lib/duration.ts'
import { formatCents } from '../../lib/money.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useOrganization } from '../organization/organization-context.ts'
import { deleteService, listServices } from './api.ts'
import { ServiceFormModal } from './ServiceFormModal.tsx'

type Editing = { mode: 'new' } | { mode: 'edit'; service: Service } | null

export function ServicesPage() {
  const { organization } = useOrganization()
  const load = useCallback(() => listServices(organization.id), [organization.id])
  const { state, reload, retry } = useAsyncData(load)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Service | null>(null)

  const newButton = (
    <Button icon={<Plus size={18} />} onClick={() => setEditing({ mode: 'new' })}>
      Novo serviço
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Serviços"
        description="O que você oferece, com duração e preço."
        action={state.status === 'ready' && state.data.length > 0 ? newButton : undefined}
      />

      {state.status === 'loading' && <LoadingState label="Carregando serviços" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível carregar os serviços.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <EmptyState
          icon={Scissors}
          title="Nenhum serviço cadastrado"
          description="Cadastre o primeiro serviço para ele aparecer na sua página de agendamento."
          action={newButton}
        />
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className={table.wrapper}>
          <table className={table.table}>
            <thead>
              <tr>
                <th scope="col">Serviço</th>
                <th scope="col">Duração</th>
                <th scope="col" className={table.numeric}>
                  Preço
                </th>
                <th scope="col">Situação</th>
                <th scope="col">
                  <span className="visually-hidden">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.data.map((service) => (
                <tr key={service.id}>
                  <td>
                    <div>{service.name}</div>
                    {service.description && (
                      <div className={table.muted}>{service.description}</div>
                    )}
                  </td>
                  <td data-label="Duração">{formatDuration(service.duration_minutes)}</td>
                  <td className={table.numeric} data-label="Preço">
                    {formatCents(service.price_cents)}
                  </td>
                  <td data-label="Situação">
                    {service.active ? (
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
                        aria-label={`Editar ${service.name}`}
                        onClick={() => setEditing({ mode: 'edit', service })}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Excluir ${service.name}`}
                        onClick={() => setDeleting(service)}
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
      )}

      {editing && (
        <ServiceFormModal
          organizationId={organization.id}
          service={editing.mode === 'edit' ? editing.service : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Excluir serviço"
          confirmLabel="Excluir"
          errorMessage={errorText}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteService(deleting.id)
            setDeleting(null)
            reload()
          }}
        >
          <p>
            Excluir <strong>{deleting.name}</strong>? Essa ação não pode ser desfeita. Se quiser só
            esconder dos clientes, edite e desmarque “Ativo”.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
