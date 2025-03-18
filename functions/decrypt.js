export async function decrypt(encryptedData){
    const response = await fetch('/api/decrypt', {
        method: 'POST',
        headers: {
            'content-Type': 'application/json',
        },
        body: JSON.stringify({ encryptedData: encryptedData }),
    });

    if(response.ok){
        const data = await response.json();
        return data.decrypted;
    }else{
        return null;
    }
}