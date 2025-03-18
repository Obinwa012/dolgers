import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.CRYPTO_SECRET_KEY, 'base64');
const ivLength = 16;

export async function POST(request) {
    try {
      const { encryptedData } = await request.json();
  
      const iv = Buffer.from(encryptedData.slice(0, ivLength * 2), 'hex');
      const encrypted = encryptedData.slice(ivLength * 2);
  
      const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
  
      // Parse the decrypted JSON string back into an object
      const parsedDecrypted = JSON.parse(decrypted);
  
      return NextResponse.json({ decrypted: parsedDecrypted });
    } catch (error) {
      console.error('Decryption error:', error);
      return NextResponse.json({ error: 'Decryption failed' }, { status: 500 });
    }
  }
  