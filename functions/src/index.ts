import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

admin.initializeApp();

export const firestore = admin.firestore();
export const auth = admin.auth();

// TODO: Add your cloud functions here.

// Example function:
export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
}); 