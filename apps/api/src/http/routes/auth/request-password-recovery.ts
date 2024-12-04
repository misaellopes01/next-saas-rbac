import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'

export async function requestPasswordRecovery(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/password/recovery',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Request Password Recovery',
        body: z.object({
          email: z.string().email(),
        }),
        response: {
          201: z.null(),
        },
      },
    },
    async (request, reply) => {
      const { email } = request.body

      const userFromEmail = await prisma.user.findUnique({
        where: {
          email,
        },
      })

      if (!userFromEmail) {
        // we don't want people to know if user really exists!
        return reply.status(201).send()
      }

      const { id: code } = await prisma.token.create({
        data: {
          type: 'PASSWORD_RECOVERY',
          userId: userFromEmail.id,
        },
      })

      console.log('Just in dev mode, Recovery token: ', code)

      return reply.status(201).send()
    },
  )
}
