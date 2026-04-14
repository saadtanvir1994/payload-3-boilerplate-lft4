import type { Access } from 'payload'

export const adminOnly: Access = ({ req }) => {
  if (!req.user) return false
  const user = req.user as { role?: string }
  return user.role === 'admin'
}
