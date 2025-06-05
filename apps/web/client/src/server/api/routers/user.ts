import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Collection, toUserSettings, userSettingsInsertSchema } from '@onlook/db';
import type { UserSettings } from '@onlook/db';
import { createDefaultUserSettings } from '@onlook/utility';

const userSettingsRoute = createTRPCRouter({
    get: protectedProcedure.input(z.object({ userId: z.string() })).query(async ({ ctx, input }) => {
        const settingsDoc = await ctx.db.collection(Collection.USER_SETTINGS).doc(input.userId).get();
        if (!settingsDoc.exists) {
            // Return default settings if none found
            return toUserSettings(createDefaultUserSettings(input.userId));
        }
        return toUserSettings(settingsDoc.data() as UserSettings);
    }),
    upsert: protectedProcedure.input(z.object({
        userId: z.string(),
        settings: userSettingsInsertSchema,
    })).mutation(async ({ ctx, input }) => {
        if (!input.userId) {
            throw new Error('User ID is required');
        }

        await ctx.db.collection(Collection.USER_SETTINGS).doc(input.userId).set(input.settings, { merge: true });
        const updatedSettingsDoc = await ctx.db.collection(Collection.USER_SETTINGS).doc(input.userId).get();
        
        if (!updatedSettingsDoc.exists) {
            throw new Error('Failed to update user settings');
        }

        return toUserSettings(updatedSettingsDoc.data() as UserSettings);
    }),
});

export const userRouter = createTRPCRouter({
    getById: protectedProcedure.input(z.string()).query(async ({ ctx, input }) => {
        const userDoc = await ctx.db.collection(Collection.USERS).doc(input).get();
        if (!userDoc.exists) {
            return null;
        }
        // Here we would also fetch related projects, but that's a separate refactoring
        return userDoc.data();
    }),
    create: protectedProcedure.input(z.object({ id: z.string(), email: z.string().optional() })).mutation(async ({ ctx, input }) => {
        await ctx.db.collection(Collection.USERS).doc(input.id).set(input);
        return { id: input.id };
    }),
    settings: userSettingsRoute,
});
