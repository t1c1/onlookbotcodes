import { env } from '@/env';
import { getResendClient, sendInvitationEmail } from '@onlook/email';
import { ProjectRole } from '@onlook/models';
import { createDefaultUserCanvas } from '@onlook/utility';
import { TRPCError } from '@trpc/server';
import dayjs from 'dayjs';
import urlJoin from 'url-join';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Collection } from '@onlook/db';

export const invitationRouter = createTRPCRouter({
    get: protectedProcedure.input(z.object({ id: z.string(), projectId: z.string() })).query(async ({ ctx, input }) => {
        const invitationDoc = await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.INVITATIONS).doc(input.id).get();

        if (!invitationDoc.exists) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Invitation not found',
            });
        }
        
        const invitation = invitationDoc.data();
        if (!invitation) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Invitation data not found',
            });
        }
        const inviterDoc = await ctx.db.collection(Collection.USERS).doc(invitation.inviterId).get();
        const inviter = inviterDoc.data();

        return {
            ...invitation,
            inviter,
        };
    }),
    list: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            const invitationsSnapshot = await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.INVITATIONS).get();
            return invitationsSnapshot.docs.map(doc => doc.data());
        }),
    create: protectedProcedure
        .input(z.object({
            projectId: z.string(),
            inviteeEmail: z.string().email(),
            role: z.nativeEnum(ProjectRole),
        }))
        .mutation(async ({ ctx, input }) => {
            const batch = ctx.db.batch();
            const newInvitationRef = ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.INVITATIONS).doc();
            
            const invitation = {
                ...input,
                id: newInvitationRef.id,
                token: uuidv4(),
                inviterId: ctx.user.uid,
                expiresAt: dayjs().add(7, 'day').toDate(),
            };

            batch.set(newInvitationRef, invitation);
            await batch.commit();

            if (!env.RESEND_API_KEY) {
                throw new TRPCError({
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'RESEND_API_KEY is not set, cannot send email',
                });
            }
            const emailClient = getResendClient({ apiKey: env.RESEND_API_KEY });

            await sendInvitationEmail(
                emailClient,
                {
                    invitedByEmail: ctx.user.email,
                    inviteLink: urlJoin(
                        env.NEXT_PUBLIC_SITE_URL,
                        'invitation',
                        invitation.id,
                        `?token=${invitation.token}`,
                    ),
                },
                { dryRun: env.NODE_ENV !== 'production' }
            );

            return invitation;
        }),
    delete: protectedProcedure
        .input(z.object({ id: z.string(), projectId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.INVITATIONS).doc(input.id).delete();
            return true;
        }),
    accept: protectedProcedure
        .input(z.object({ token: z.string(), id: z.string(), projectId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const invitationRef = ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.INVITATIONS).doc(input.id);
            const invitationDoc = await invitationRef.get();

            if (!invitationDoc.exists) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' });
            }

            const invitation = invitationDoc.data();
            if (!invitation) {
                throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation data not found' });
            }
            if (invitation.token !== input.token || invitation.inviteeEmail !== ctx.user.email) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid invitation token' });
            }
            if (dayjs().isAfter(dayjs(invitation.expiresAt))) {
                await invitationRef.delete();
                throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invitation has expired' });
            }

            const batch = ctx.db.batch();
            batch.delete(invitationRef);

            const userProjectRef = ctx.db.collection(Collection.USERS).doc(ctx.user.uid).collection('projects').doc(input.projectId);
            batch.set(userProjectRef, { role: invitation.role });
            
            const canvasSnapshot = await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.CANVAS).limit(1).get();
            const canvasDoc = canvasSnapshot.docs[0];
            if (canvasDoc) {
                const newUserCanvas = createDefaultUserCanvas(ctx.user.uid, canvasDoc.id);
                const userCanvasRef = canvasDoc.ref.collection('userCanvases').doc(ctx.user.uid);
                batch.set(userCanvasRef, newUserCanvas);
            }

            await batch.commit();
        }),
});
