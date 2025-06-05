import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { Collection } from '@onlook/db';
import { ProjectRole } from '@onlook/models';
import { createDefaultCanvas, createDefaultFrame, createDefaultUserCanvas } from '@onlook/utility';

export const projectRouter = createTRPCRouter({
    getFullProject: protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
            const projectDoc = await ctx.db.collection(Collection.PROJECTS).doc(input.projectId).get();
            if (!projectDoc.exists) {
                console.error('project not found');
                return null;
            }
            const project = projectDoc.data();
            if (!project) {
                console.error('project data not found');
                return null;
            }

            const canvasCollection = ctx.db.collection(Collection.PROJECTS).doc(input.projectId).collection(Collection.CANVAS);
            const canvasSnapshot = await canvasCollection.limit(1).get();
            const canvasDoc = canvasSnapshot.docs[0];
            const canvas = canvasDoc ? canvasDoc.data() : createDefaultCanvas(project.id);

            if (!canvas) {
                console.error('canvas data not found');
                return null;
            }

            const framesSnapshot = await canvasCollection.doc(canvas.id).collection('frames').get();
            const frames = framesSnapshot.docs.map(doc => doc.data());

            const userCanvasSnapshot = await canvasCollection.doc(canvas.id).collection('userCanvases').where('userId', '==', ctx.user.uid).limit(1).get();
            const userCanvasDoc = userCanvasSnapshot.docs[0];
            const userCanvas = userCanvasDoc ? userCanvasDoc.data() : createDefaultUserCanvas(ctx.user.uid, canvas.id);
            
            return {
                project,
                userCanvas,
                frames,
            };
        }),
    create: protectedProcedure
        .input(z.object({ project: z.any(), userId: z.string() })) // Loosening type for now
        .mutation(async ({ ctx, input }) => {
            const newProjectRef = ctx.db.collection(Collection.PROJECTS).doc();
            const projectId = newProjectRef.id;

            const batch = ctx.db.batch();

            batch.set(newProjectRef, { ...input.project, id: projectId });

            const userProjectRef = ctx.db.collection(Collection.USERS).doc(input.userId).collection('projects').doc(projectId);
            batch.set(userProjectRef, { role: ProjectRole.OWNER });

            const newCanvas = createDefaultCanvas(projectId);
            const canvasRef = newProjectRef.collection(Collection.CANVAS).doc(newCanvas.id);
            batch.set(canvasRef, newCanvas);

            const newUserCanvas = createDefaultUserCanvas(input.userId, newCanvas.id);
            const userCanvasRef = canvasRef.collection('userCanvases').doc(input.userId);
            batch.set(userCanvasRef, newUserCanvas);
            
            const newFrame = createDefaultFrame(newCanvas.id, input.project.sandboxUrl);
            const frameRef = canvasRef.collection('frames').doc();
            batch.set(frameRef, newFrame);

            await batch.commit();

            return { ...input.project, id: projectId };
        }),
    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // This is a complex operation in Firestore and should be handled with care,
            // often with a Cloud Function to ensure atomicity and correctness.
            // For now, we'll just delete the main project document.
            await ctx.db.collection(Collection.PROJECTS).doc(input.id).delete();
        }),
    getPreviewProjects: protectedProcedure
        .input(z.object({ userId: z.string() }))
        .query(async ({ ctx, input }) => {
            const userProjectsSnapshot = await ctx.db.collection(Collection.USERS).doc(input.userId).collection('projects').get();
            const projectIds = userProjectsSnapshot.docs.map(doc => doc.id);

            if (projectIds.length === 0) {
                return [];
            }

            const projectsSnapshot = await ctx.db.collection(Collection.PROJECTS).where('id', 'in', projectIds).get();
            return projectsSnapshot.docs.map(doc => doc.data());
        }),
    update: protectedProcedure.input(z.any()).mutation(async ({ ctx, input }) => { // Loosening type for now
        if (!input.id) {
            throw new Error('Project ID is required');
        }
        await ctx.db.collection(Collection.PROJECTS).doc(input.id).set(input, { merge: true });
    }),
});
