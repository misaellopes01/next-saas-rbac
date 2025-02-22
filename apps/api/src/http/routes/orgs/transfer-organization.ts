import { organizationSchema } from '@saas/auth'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'

import { BadRequestError } from '../_errors/bad-request-errors'
import { UnauthorizedError } from '../_errors/unauthorized-error'

export async function transferOrganization(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/organizations/:slug/owner',
      {
        schema: {
          tags: ['Orgs'],
          summary: 'Transfer organization ownership',
          security: [{ bearerAuth: [] }],
          body: z.object({
            transferToUsrId: z.string().uuid(),
          }),
          params: z.object({
            slug: z.string(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params

        const userId = await request.getCurrentUserId()

        const { membership, organization } =
          await request.getUserMembership(slug)

        const authOrganization = organizationSchema.parse(organization)

        const { cannot } = getUserPermissions(userId, membership.role)

        if (cannot('transfer_ownership', authOrganization)) {
          throw new UnauthorizedError(
            'You are not allowed to transfer this organization ownership!',
          )
        }

        const { transferToUsrId } = request.body

        const transferToMembership = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: transferToUsrId,
            },
          },
        })

        if (!transferToMembership) {
          throw new BadRequestError(
            'User is not a member of this organization!',
          )
        }

        await prisma.$transaction(async (tx) => {
          await tx.member.update({
            where: {
              organizationId_userId: {
                organizationId: organization.id,
                userId: transferToUsrId,
              },
            },
            data: {
              role: 'ADMIN',
            },
          })

          await tx.organization.update({
            where: {
              id: organization.id,
            },
            data: {
              ownerId: transferToUsrId,
            },
          })
        })

        return reply.status(204).send()
      },
    )
}
