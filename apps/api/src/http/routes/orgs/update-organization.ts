import { organizationSchema } from '@saas/auth'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import z from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/utils/get-user-permissions'

import { BadRequestError } from '../_errors/bad-request-errors'
import { UnauthorizedError } from '../_errors/unauthorized-error'

export async function updateOrganization(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/organizations/:slug',
      {
        schema: {
          tags: ['Orgs'],
          summary: 'Update organization',
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string(),
            domain: z.string().nullish(),
            shouldAttachUsersByDomain: z.boolean().optional(),
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

        if (cannot('update', authOrganization)) {
          throw new UnauthorizedError(
            'You are not allowed to update this organization!',
          )
        }

        const { name, domain, shouldAttachUsersByDomain } = request.body

        if (domain) {
          const existingAnotherOrgSame = await prisma.organization.findFirst({
            where: {
              domain,
              id: {
                not: organization.id,
              },
            },
          })

          if (existingAnotherOrgSame) {
            throw new BadRequestError(
              'Organization with this domain already exists!',
            )
          }
        }

        await prisma.organization.update({
          where: {
            id: organization.id,
          },
          data: {
            name,
            domain,
            // slug: generateSlug(name),
            shouldAttachUsersByDomain,
          },
        })

        return reply.status(204).send()
      },
    )
}
