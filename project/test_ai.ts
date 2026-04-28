import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const res = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: 'Hello'
        });
        console.log(res.text);
    } catch(e) {
        console.error(e);
    }
}
run();
