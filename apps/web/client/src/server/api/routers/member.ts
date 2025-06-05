import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Collection } from '@onlook/db';

export const memberRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                projectId: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const projectMembersSnapshot = await ctx.db.collectionGroup('projects').where('projectId', '==', input.projectId).get();
            const members = await Promise.all(projectMembersSnapshot.docs.map(async (doc) => {
                const userDoc = await doc.ref.parent.parent!.get();
                return {
                    ...doc.data(),
                    user: userDoc.data(),
                };
            }));
            return members;
        }),
    remove: protectedProcedure
        .input(z.object({ userId: z.string(), projectId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.collection(Collection.USERS).doc(input.userId).collection('projects').doc(input.projectId).delete();
            return true;
        }),
});
