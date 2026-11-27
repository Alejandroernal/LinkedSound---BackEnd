import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'La contrasena debe tener al menos 8 caracteres e incluir al menos una letra mayuscula, una letra minuscula y un numero.'

export const validatePasswordStrength = (password: unknown): string | null => {
  if (typeof password !== 'string' || !password) {
    return 'La contrasena es obligatoria.'
  }
  if (password.length < 8) {
    return 'La contrasena debe tener al menos 8 caracteres.'
  }
  if (!/[A-Z]/.test(password)) {
    return 'La contrasena debe incluir al menos una letra mayuscula.'
  }
  if (!/[a-z]/.test(password)) {
    return 'La contrasena debe incluir al menos una letra minuscula.'
  }
  if (!/[0-9]/.test(password)) {
    return 'La contrasena debe incluir al menos un numero.'
  }
  return null
}

export const assertValidPassword = (password: unknown): void => {
  const errorMsg = validatePasswordStrength(password)
  if (errorMsg) {
    const err = new Error(errorMsg)
    ;(err as any).statusCode = 400
    throw err
  }
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}
