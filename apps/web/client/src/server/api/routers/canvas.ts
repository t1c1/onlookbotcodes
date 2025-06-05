import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Collection } from '@onlook/db';

export const canvasRouter = createTRPCRouter({
    get: protectedProcedure
        .input(
            z.object({
                projectId: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const canvasSnapshot = await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.CANVAS).limit(1).get();
            if (canvasSnapshot.empty) {
                return null;
            }
            return canvasSnapshot.docs[0].data();
        }),
    update: protectedProcedure.input(
        z.object({
            id: z.string(),
            projectId: z.string(),
            // Add other canvas properties here as needed, for now we'll allow any
        }).passthrough()
    ).mutation(async ({ ctx, input }) => {
        try {
            const { id, projectId, ...dataToUpdate } = input;
            await ctx.db.collection(Collection.PROJECTS).doc(projectId).collection(Collection.CANVAS).doc(id).set(dataToUpdate, { merge: true });
            return true;
        } catch (error) {
            console.error('Error updating canvas', error);
            return false;
        }
    }),
});
