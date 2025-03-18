export async function encrypt(data){
    const response = await fetch('/api/encrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: data }),
    });
  
    if(response.ok){
        const data = await response.json();
        return data.encryptedData;
    }else{
        return null;
    }
  }