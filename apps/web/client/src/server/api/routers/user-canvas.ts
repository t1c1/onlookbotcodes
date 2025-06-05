import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Collection } from '@onlook/db';

export const userCanvasRouter = createTRPCRouter({
    get: protectedProcedure
        .input(
            z.object({
                projectId: z.string(),
                canvasId: z.string(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const userCanvasDoc = await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.CANVAS).doc(input.canvasId).collection('userCanvases').doc(ctx.user.uid).get();

            if (!userCanvasDoc.exists) {
                throw new Error('User canvas not found');
            }
            return userCanvasDoc.data();
        }),
    update: protectedProcedure.input(z.any()).mutation(async ({ ctx, input }) => { // Loosening type for now
        try {
            if (!input.canvasId) {
                throw new Error('Canvas ID is required');
            }
            await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.CANVAS).doc(input.canvasId).collection('userCanvases').doc(ctx.user.uid).set(input, { merge: true });
            return true;
        } catch (error) {
            console.error('Error updating user canvas', error);
            return false;
        }
    }),
});
