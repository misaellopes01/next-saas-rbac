import { AbilityBuilder } from '@casl/ability'

import { AppAbility } from '.'
import { User } from './model/user'
import { Role } from './role'

type PermissionsByRole = (
  user: User,
  builder: AbilityBuilder<AppAbility>,
) => void

export const permissions: Record<Role, PermissionsByRole> = {
  ADMIN(_, { can }) {
    can('manage', 'all')
    can('delete', 'User')
  },
  MEMBER(user, { can }) {
    // can('invite', 'User')
    can(['create', 'get'], 'Project')
    can(['update', 'delete'], 'Project', { ownerId: { $eq: user.id } })
  },
  BILLING() {},
}
