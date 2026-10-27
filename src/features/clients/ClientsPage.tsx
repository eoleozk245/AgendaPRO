import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { EmptyState } from '../../components/EmptyState.tsx'
import { LoadingState } from '../../components/LoadingState.tsx'
import { PageHeader } from '../../components/PageHeader.tsx'
import table from '../../components/Table.module.css'
import { TextField } from '../../components/TextField.tsx'
import type { Client } from '../../lib/database.types.ts'
import { errorText } from '../../lib/db-errors.ts'
import { formatPhone } from '../../lib/phone.ts'
import { useAsyncData } from '../../lib/useAsyncData.ts'
import { useOrganization } from '../organization/organization-context.ts'
import { deleteClient, listClients } from './api.ts'
import { ClientFormModal } from './ClientFormModal.tsx'
import { filterClients } from './filter.ts'
import styles from './ClientsPage.module.css'

type Editing = { mode: 'new' } | { mode: 'edit'; client: Client } | null

export function ClientsPage() {
  const { organization } = useOrganization()
  const load = useCallback(() => listClients(organization.id), [organization.id])
  const { state, reload, retry } = useAsyncData(load)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const visible = useMemo(
    () => (state.status === 'ready' ? filterClients(state.data, query) : []),
    [state, query],
  )

  const newButton = (
    <Button icon={<Plus size={18} />} onClick={() => setEditing({ mode: 'new' })}>
      Novo cliente
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Quem agenda com você. Guarde só o necessário."
        action={state.status === 'ready' && state.data.length > 0 ? newButton : undefined}
      />
      {state.status === 'loading' && <LoadingState label="Carregando clientes" />}
      {state.status === 'error' && (
        <Alert tone="error" title="Não foi possível carregar os clientes.">
          <Button variant="secondary" size="sm" onClick={retry}>
            Tentar de novo
          </Button>
        </Alert>
      )}
      {state.status === 'ready' && state.data.length === 0 && (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Os clientes aparecem aqui quando agendam pela sua página ou quando você cadastra."
          action={newButton}
        />
      )}
      {state.status === 'ready' && state.data.length > 0 && (
        <div className={styles.content}>
          <div className={styles.search}>
            <Search size={18} aria-hidden="true" className={styles.searchIcon} />
            <TextField
              label="Buscar cliente"
              type="search"
              placeholder="Nome, telefone ou e-mail"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum cliente encontrado"
              description="Tente outro termo."
            />
          ) : (
            <div className={table.wrapper}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Telefone</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">
                      <span className="visually-hidden">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td className={table.numeric} data-label="Telefone">
                        {client.phone ? (
                          formatPhone(client.phone)
                        ) : (
                          <span className={table.muted}>—</span>
                        )}
                      </td>
                      <td data-label="E-mail">
                        {client.email ?? <span className={table.muted}>—</span>}
                      </td>
                      <td>
                        <div className={table.actions}>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${client.name}`}
                            onClick={() => setEditing({ mode: 'edit', client })}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Excluir ${client.name}`}
                            onClick={() => setDeleting(client)}
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
        </div>
      )}
      {editing && (
        <ClientFormModal
          organizationId={organization.id}
          client={editing.mode === 'edit' ? editing.client : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Excluir cliente"
          confirmLabel="Excluir"
          errorMessage={errorText}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteClient(deleting.id)
            setDeleting(null)
            reload()
          }}
        >
          <p>
            Excluir <strong>{deleting.name}</strong>? Os dados pessoais dessa pessoa serão apagados
            e não dá para desfazer.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
