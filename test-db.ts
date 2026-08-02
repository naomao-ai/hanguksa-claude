import { db } from './src/lib/firebase-admin.ts'; 
async function run() { 
  const snap = await db.collection('questions').where('examRound', '==', 78).where('number', '==', 41).get(); 
  console.log(snap.docs[0].data()); 
} 
run();
