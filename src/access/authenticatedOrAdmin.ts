import type { Access } from 'payload'

/**
 * Grants access to any authenticated user.
 * Admin-level filtering is enforced via where clauses on individual collections.
 */
export const authenticatedOrAdmin: Access = ({ req: { user } }) => {
  return Boolean(user)
}
