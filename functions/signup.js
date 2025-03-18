'use client'
import { auth } from '@/libs/firebase/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { encrypt } from './encrypt';



export async function signup(email, password){
    try{
        //Create new user
        const userCredential =  await createUserWithEmailAndPassword(auth, email, password);

        //If creation was successful fetch user's token
        const idToken = await userCredential.user.getIdToken();

        //Create a name from users email address
        const username = email.split('@')[0];
        const capitalizedUsername = username.slice(0,1).toString().toUpperCase() + username.slice(1,username.length).toString();
        

        //Encrypt users data 
        const data = {
            name: capitalizedUsername,
            email: userCredential.user.email,
            customerId: userCredential.user.uid,
            cart: [],
            wishlist: [],
        } 
        const encryptedData = await encrypt(data)

        if(encryptedData !== null){

            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                'Authorization': `Bearer ${idToken}`, 
                'Content-Type': 'application/json',
                },
                body: JSON.stringify({ encryptedData: encryptedData }),
            });

            if(response.ok){
                return [encryptedData, data];
            } else {
                return null;
            }
        } else {
            return null;
        } 
    }catch(error){
        return error.code.toString();
    }
}