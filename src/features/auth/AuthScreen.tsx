import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { focusFirstInvalid } from '../../lib/focus.ts'
import { Alert } from '../../components/Alert.tsx'
import { Button } from '../../components/Button.tsx'
import { Card } from '../../components/Card.tsx'
import { TextField } from '../../components/TextField.tsx'
import { supabase } from '../../lib/supabase.ts'
import { authErrorMessage } from './errors.ts'
import {
  fieldErrorsFrom,
  PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
  type AuthFieldErrors,
} from './schemas.ts'
import styles from './AuthScreen.module.css'

type Mode = 'sign-in' | 'sign-up'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string>()

  const isSignUp = mode === 'sign-up'

  function switchMode(next: Mode) {
    setMode(next)
    setFieldErrors({})
    setFormError(undefined)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = (isSignUp ? signUpSchema : signInSchema).safeParse({ email, password })
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error))
      focusFirstInvalid(event.currentTarget)
      return
    }
    setFieldErrors({})
    setFormError(undefined)
    setSubmitting(true)

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) {
          setFormError(authErrorMessage(error))
        } else if (!data.session) {
          // Confirmação de e-mail ligada: a conta só vale depois do link.
          setConfirmationSentTo(parsed.data.email)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(parsed.data)
        if (error) setFormError(authErrorMessage(error))
      }
    } catch {
      setFormError('Sem conexão com o servidor. Verifique sua internet e tente de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (confirmationSentTo) {
    return (
      <Card className={styles.card}>
        <div className={styles.confirmation}>
          <MailCheck size={32} aria-hidden="true" className={styles.confirmationIcon} />
          <h1 className={styles.title}>Confira seu e-mail</h1>
          <p className={styles.subtitle}>
            Enviamos um link de confirmação para <strong>{confirmationSentTo}</strong>. Abra o link
            para ativar sua conta e depois entre aqui.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmationSentTo(undefined)
              switchMode('sign-in')
            }}
          >
            Voltar para o login
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.title}>{isSignUp ? 'Criar conta' : 'Entrar'}</h1>
        <p className={styles.subtitle}>
          {isSignUp
            ? 'Cadastre-se para configurar a agenda do seu estabelecimento.'
            : 'Acesse a agenda do seu estabelecimento.'}
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          label="Senha"
          type="password"
          name="password"
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={isSignUp ? `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.` : undefined}
          error={fieldErrors.password}
        />
        {formError && <Alert tone="error" title={formError} />}
        <Button type="submit" loading={submitting} className={styles.submit}>
          {isSignUp ? 'Criar conta' : 'Entrar'}
        </Button>
      </form>

      <p className={styles.switch}>
        {isSignUp ? 'Já tem conta?' : 'Ainda não tem conta?'}{' '}
        <button
          type="button"
          className={styles.link}
          onClick={() => switchMode(isSignUp ? 'sign-in' : 'sign-up')}
        >
          {isSignUp ? 'Entrar' : 'Criar conta'}
        </button>
      </p>
    </Card>
  )
}
