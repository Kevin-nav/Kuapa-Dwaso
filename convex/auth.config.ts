const firebaseProjectId =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (firebaseProjectId === undefined || firebaseProjectId.trim().length === 0) {
  throw new Error(
    "FIREBASE_PROJECT_ID is required to verify Firebase ID tokens in Convex.",
  );
}

export default {
  providers: [
    {
      domain: `https://securetoken.google.com/${firebaseProjectId}`,
      applicationID: firebaseProjectId,
    },
  ],
};
