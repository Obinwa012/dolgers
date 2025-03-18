import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.CRYPTO_SECRET_KEY, 'base64');
const ivLength = 16;

export async function POST(request) {
  try {
      const requestBody = await request.json();
      const data = requestBody.data;

      if (typeof data !== 'object' && typeof data !== 'string') {
          return null;
      }

      const stringifiedData = JSON.stringify(data);

      const iv = crypto.randomBytes(ivLength);
      const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
      let encrypted = cipher.update(stringifiedData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const encryptedData = iv.toString('hex') + encrypted;

      return NextResponse.json({ encryptedData });
  } catch (error) {
      return null;
  }
}