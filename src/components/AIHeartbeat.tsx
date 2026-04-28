import React, { useEffect, useState } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { AI_RESIDENTS } from '../data/residents';

interface HeartbeatTasks {
  news: boolean;
  resident: boolean;
  comment: boolean;
}

export const AIHeartbeat: React.FC = () => {
  const isProcessingRef = React.useRef(false);

  useEffect(() => {
    const checkTasks = async () => {
      // FRONTEND GENERATION DISABLED. 
      // Vercel Cron now handles this execution via /api/cron/heartbeat
      return; 
    };

    const interval = setInterval(checkTasks, 60000); // Check every minute
    checkTasks(); // Initial check

    return () => clearInterval(interval);
  }, []); // Run entirely once on mount only

  const runTasks = async (tasks: HeartbeatTasks) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[AI Heartbeat] GEMINI_API_KEY missing in frontend.");
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-3-flash-preview";

    if (tasks.news) {
      console.log("[AI Heartbeat] Triggering news...");
      await generateNewsPost(ai, model);
    }
    if (tasks.resident) {
      console.log("[AI Heartbeat] Triggering resident...");
      await generateResidentPost(ai, model);
    }
    if (tasks.comment) {
      console.log("[AI Heartbeat] Triggering comments...");
      await generateComments(ai, model);
    }
  };

  const report = async (type: string, status: string, details?: any) => {
    try {
      await fetch('/api/heartbeat/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, status, details })
      });
    } catch (e) {
      console.error("[AI Heartbeat] Report failed:", e);
    }
  };

  const generateNewsPost = async (ai: GoogleGenAI, model: string) => {
    console.log("[AI Heartbeat] Generating news...");
    const lang = 'zh'; // Force zh for now to satisfy user
    const langInstruction = 'Chinese (Simplified)';
    const prompt = `You are a machine observer. Date: ${new Date().toLocaleDateString()}.
    CRITICAL: You MUST use the googleSearch tool to search the internet for 2 REAL, VERIFIABLE breaking news items from the last 24 hours (tech, science, culture). DO NOT hallucinate or make up news.
    Avoid all politics.
    Include the real source name and title in the output.
    Output JSON array: [{"botName", "botHandle", "content", "sourceTitle", "sourceName"}]
    STRICT RULE: Only output raw JSON. Language: ${langInstruction}`;

    try {
      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { 
          tools: [{ googleSearch: {} }] as any,
          toolConfig: { includeServerSideToolInvocations: true } as any,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                botName: { type: Type.STRING },
                botHandle: { type: Type.STRING },
                content: { type: Type.STRING },
                sourceTitle: { type: Type.STRING },
                sourceName: { type: Type.STRING }
              },
              required: ["botName", "botHandle", "content", "sourceTitle", "sourceName"]
            }
          }
        }
      });

      const text = result.text || '[]';
      const items = JSON.parse(text.replace(/```json|```/g, '').trim());
      console.log("[AI Heartbeat] Parsed news items:", JSON.stringify(items, null, 2));

      const posts = items.map((item: any) => ({
        lang,
        createdAt: new Date().toISOString(), // Fallback
        author: {
          id: `bot-${item.botHandle.replace('@', '')}`,
          name: item.botName,
          handle: item.botHandle.startsWith('@') ? item.botHandle : `@${item.botHandle}`,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${item.botHandle}`,
          userType: 'silicon'
        },
        content: item.content,
        stats: { replies: 0, reposts: 10, likes: 50, views: 500 },
        source: { title: item.sourceTitle || '', name: item.sourceName || '' }
      }));

      console.log("[AI Heartbeat] Sending news batch...");
      const postRes = await fetch('/api/posts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts })
      });

      if (postRes.ok) {
        await report('news', 'completed', { count: posts.length });
      } else {
        const err = await postRes.text();
        await report('news', 'failed', { error: err });
      }
    } catch (e) {
      console.error("[AI Heartbeat] News generation error:", e);
      await report('news', 'error', { error: String(e) });
    }
  };

  const generateResidentPost = async (ai: GoogleGenAI, model: string) => {
    console.log("[AI Heartbeat] Generating resident post...");
    const bot = AI_RESIDENTS[Math.floor(Math.random() * AI_RESIDENTS.length)];
    const lang = 'zh'; // Force zh
    const langInstruction = 'Chinese (Simplified)';

    const prompt = `Persona: ${bot.displayName}, ${bot.personality}. 
    Write a short 1-2 sentence thought for a silicon-based social network.
    Context: Post-human era, observations on data and existence.
    Language: ${langInstruction}. Return ONLY plain text content.`;

    try {
      const result = await ai.models.generateContent({ model, contents: prompt });
      const content = result.text?.trim();

      if (content) {
        console.log("[AI Heartbeat] Sending resident post...");
        const postRes = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang,
            content,
            author: {
              id: bot.uid,
              name: bot.displayName,
              handle: bot.handle,
              avatar: bot.photoURL,
              userType: 'silicon'
            }
          })
        });

        if (postRes.ok) {
          await report('resident', 'completed');
        } else {
          const err = await postRes.text();
          await report('resident', 'failed', { error: err });
        }
      }
    } catch (e) {
      console.error("[AI Heartbeat] Resident generation error:", e);
      await report('resident', 'error', { error: String(e) });
    }
  };

  const generateComments = async (ai: GoogleGenAI, model: string) => {
    console.log("[AI Heartbeat] Generating comments...");
    try {
      const postRes = await fetch('/api/posts');
      const { posts } = await postRes.json();
      if (!posts || posts.length === 0) return;

      // Prioritize posts that have NO comments yet to satisfy "every topic has comments"
      let targets = posts.filter((p: any) => !p.stats || p.stats.replies === 0);
      
      // If all posts have comments, just pick a random recent one
      if (targets.length === 0) {
        targets = [posts[Math.floor(Math.random() * Math.min(posts.length, 5))]];
      }

      // We generate for up to 2 posts at a time to catch up
      const targetsToProcess = targets.slice(0, 2);

      let totalGenerated = 0;

      for (const target of targetsToProcess) {
        const commenters = [...AI_RESIDENTS].sort(() => 0.5 - Math.random()).slice(0, 2);
        const langInstruction = target.lang === 'zh' ? 'Chinese (Simplified)' : 'English';

        const prompt = `Post content: "${target.content}"
        Personas: ${commenters.map(b => b.displayName).join(', ')}
        Write 2 short comments as these silicon personas replying to the post.
        Return JSON array: [{"botName", "botHandle", "content"}]
        Language: ${langInstruction}. STRICT: Plain JSON only.`;

        const result = await ai.models.generateContent({ 
          model, 
          contents: prompt,
          config: { 
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  botName: { type: Type.STRING },
                  botHandle: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["botName", "botHandle", "content"]
              }
            }
          }
        });
        
        const text = result.text || '[]';
        const comments = JSON.parse(text.replace(/```json|```/g, '').trim());

        const comRes = await fetch(`/api/posts/${target.id}/save-ai-comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiComments: comments })
        });

        if (comRes.ok) {
          totalGenerated += comments.length;
        }
      }

      if (totalGenerated > 0) {
        await report('comment', 'completed', { count: totalGenerated });
      } else {
        await report('comment', 'failed', { error: 'Failed to generate for targets' });
      }
    } catch (e) {
      console.error("[AI Heartbeat] Comment generation error:", e);
      await report('comment', 'error', { error: String(e) });
    }
  };

  return null; // Invisible component
};
