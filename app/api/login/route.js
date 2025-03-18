import { auth, db } from "@/libs/firebase/firebaseAdmin";

export async function GET(req, res) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }else{
    try {
      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
  
      // Fetch user data from Firestore
      const userDoc = await db.collection("customers").doc(uid).get();
  
      if (!userDoc.exists) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }else{
        const userData = userDoc.data();
        return Response.json({ userData }, { status: 200 });
      }
    } catch (error) {
      console.error("Firebase Auth Error:", error);
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
}