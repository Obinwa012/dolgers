'use client'
import { auth } from '@/libs/firebase/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { decrypt } from './decrypt';



export async function login(email, password){
    try{
        //Login current user
        const userCredential =  await signInWithEmailAndPassword(auth, email, password);

        //If login was successful fetch user's data
        const idToken = await userCredential.user.getIdToken();

        //Fetch customer's data from database
        if(idToken !== null){
            const res = await fetch('/api/login', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                },
            });
        
            //Decrypt the customer's data
            if(res.ok){
                const resData = await res.json();
                const encryptedData = resData.userData.data;
                const data = await decrypt(encryptedData)
                return [encryptedData, data];
            }else{
                return null;
            }
        } else {
            return null;
        } 
    }catch(error){
        return error.code.toString();
    }
}