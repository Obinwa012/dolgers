import { auth, db } from '@/libs/firebase/firebaseAdmin';

export async function POST(req, res) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const body = await req.json();
    const { encryptedData } = body;

    // Create a new customer document in Firestore with the data field
    await db.collection("customers").doc(uid).set({
      data: encryptedData,
    });

    return Response.json({ message: "Customer data stored successfully" }, { status: 201 });
  } catch (error) {
    console.error("Firebase Auth/Firestore Error:", error);
    return null;
  }
}