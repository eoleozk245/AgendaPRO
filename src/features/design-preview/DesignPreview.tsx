import { CalendarX, Check, CircleCheck, Clock, Plus, UserX, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Alert } from '../../components/Alert.tsx'
import { Badge } from '../../components/Badge.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { TextField } from '../../components/TextField.tsx'
import styles from './DesignPreview.module.css'

// Página temporária da Etapa 1 para conferir tokens e componentes nos dois temas.
// Sai do ar quando as telas reais existirem. Todos os dados aqui são de exemplo.
export function DesignPreview() {
  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h1 className={styles.title}>Fundação visual</h1>
        <p className={styles.lead}>
          Página temporária para conferir cores, tipografia e componentes. Os dados são de exemplo.
        </p>
      </div>

      <Card>
        <h2 className={styles.sectionTitle}>Botões</h2>
        <div className={styles.row}>
          <Button icon={<Plus size={18} />}>Novo agendamento</Button>
          <Button variant="secondary">Reagendar</Button>
          <Button variant="ghost">Ver detalhes</Button>
          <Button variant="danger">Cancelar agendamento</Button>
        </div>
        <div className={styles.row}>
          <Button size="sm">Pequeno</Button>
          <Button disabled>Desabilitado</Button>
          <Button loading>Salvando</Button>
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Formulário</h2>
        <ExampleForm />
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Alertas</h2>
        <div className={styles.stack}>
          <Alert tone="info" title="Horário de funcionamento">
            Os horários livres seguem o fuso America/Sao_Paulo.
          </Alert>
          <Alert tone="success" title="Agendamento confirmado" />
          <Alert tone="warning" title="Faltam dados do cliente">
            Telefone não informado.
          </Alert>
          <Alert tone="error" title="Horário indisponível">
            Outro cliente reservou este horário. Escolha outro.
          </Alert>
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Estados do agendamento</h2>
        <div className={styles.row}>
          <Badge tone="warning" icon={<Clock size={14} />}>
            Pendente
          </Badge>
          <Badge tone="info" icon={<CircleCheck size={14} />}>
            Confirmado
          </Badge>
          <Badge tone="success" icon={<Check size={14} />}>
            Concluído
          </Badge>
          <Badge tone="neutral" icon={<X size={14} />}>
            Cancelado
          </Badge>
          <Badge tone="error" icon={<UserX size={14} />}>
            Não compareceu
          </Badge>
        </div>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Estado vazio</h2>
        <div className={styles.empty}>
          <CalendarX size={32} aria-hidden="true" />
          <p className={styles.emptyTitle}>Nenhum agendamento hoje</p>
          <p className={styles.emptyText}>Quando alguém reservar um horário, ele aparece aqui.</p>
          <Button variant="secondary" size="sm" icon={<Plus size={16} />}>
            Criar agendamento
          </Button>
        </div>
      </Card>
    </div>
  )
}

function ExampleForm() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('Informe o nome do cliente (pelo menos 2 letras).')
      setSent(false)
      return
    }
    setError(undefined)
    setSent(true)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="Nome do cliente"
        name="name"
        required
        autoComplete="off"
        placeholder="Ex.: Cliente Exemplo"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error}
      />
      <TextField
        label="Telefone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        hint="Opcional. Usado só para avisar sobre o agendamento."
      />
      <TextField label="Profissional" name="professional" value="Profissional Exemplo" disabled />
      <div className={styles.row}>
        <Button type="submit">Salvar cliente</Button>
      </div>
      {sent && <Alert tone="success" title="Exemplo salvo (nada foi enviado ao servidor)." />}
    </form>
  )
}
