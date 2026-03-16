// scripts/generate-embeddings.ts
// Run securely via `node --loader ts-node/esm scripts/generate-embeddings.ts`
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import url from 'url';

// Load environment variables early (local fallback)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Gemini and Supabase
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATA_DIR = path.resolve(process.cwd(), 'public/data');
const TAFSIR_KEMENAG_ID = 14;

// Interfaces for our JSON data
interface VerseData {
  id: number;
  verse_key: string;
  text_uthmani?: string;
  translations?: Array<{
    id: number;
    resource_id: number;
    text: string;
  }>;
}

interface TafsirData {
  tafsirs: Array<{
    id: number;
    resource_id: number;
    text: string;
  }>;
}

// Helper to chunk large texts to prevent exceeding token limits.
// Kemenag tafsirs can be very long. We'll split by sentences or strict character limits.
function chunkText(text: string, maxLen: number = 800): string[] {
  if (!text) return [];
  // Remove HTML tags often found in Kemenag tafsir JSON
  const cleanText = text.replace(/<\/?[^>]+(>|$)/g, "");
  
  const chunks: string[] = [];
  let currentChunk = "";
  
  // Split by sentences (very basic heuristic)
  const sentences = cleanText.split(/(?<=[.?!])\s+/);
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxLen) {
      if (currentChunk.trim()) {
         chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += " " + sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function processSurah(surahId: number) {
  console.log(`\n============================`);
  console.log(`Processing Surah ${surahId}`);
  console.log(`============================`);
  
  // 1. Read Chapter Verses (with Indonesian translation resource_id 33)
  const quranPath = path.join(DATA_DIR, `samples/surah-${surahId}.json`); // Simplified sample path 
  let verses: any[] = [];
  // Attempt to read the verses data, depending on directory structure
  // Some structures might save as `quran/${surahId}.json`
  try {
      const quranFile = fs.readFileSync(path.join(DATA_DIR, `quran/${surahId}.json`), 'utf-8');
      const quranJson = JSON.parse(quranFile);
      verses = quranJson.verses || [];
  } catch(e) {
      console.warn(`Could not read /quran/${surahId}.json directly. You might need to adjust the path reading logic.`);
      return;
  }
  
  
  // 2. Process each verse
  for (const verse of verses) {
    // Basic extraction
    const verseNum = parseInt(verse.verse_key.split(':')[1]);
    const translationText = verse.translations && verse.translations[0] ? verse.translations[0].text : "";
    const arabicContent = verse.text_uthmani || "";
    
    // Chunk A: Arabic + Translation
    const baseContent = `Surat ${surahId} Ayat ${verseNum}\nArab: ${arabicContent}\nTerjemahan: ${translationText.replace(/<\/?[^>]+(>|$)/g, "")}`;
    
    try {
        const payload = {
            contents: baseContent,
            model: "text-embedding-004", // The Gemini model we are using
        }
        console.log(`Processing Verse ${verse.verse_key}...`);
        
        // 1. Generate text embeddings via Google GenAI SDK
        const response = await ai.models.embedContent(payload);
        const embeddingArray = response.embeddings?.[0]?.values;

        if (!embeddingArray) {
             console.error(`❌ Empty embedding vector returned by API for [${verse.verse_key}]`);
             continue;
        }

        // 2. Save vector and text into Supabase
        const { error } = await supabase
          .from('quran_embeddings')
          .insert({
            content: baseContent,
            surah_id: surahId,
            verse_id: verseNum,
            tafsir_id: null,
            embedding: embeddingArray
          });

        if (error) {
           console.error(`❌ Supabase Database insertion Error [${verse.verse_key}]:`, error.message);
        } else {
           console.log(`✅ Upserted [${verse.verse_key}] -> Vector Dimension: ${embeddingArray.length}`);
        }

        // Avoid hitting Google API rate limits too quickly - wait ~300ms
        await new Promise(r => setTimeout(r, 300));
        
    } catch(err: any) {
        console.error(`🚨 Fatal Error converting/embedding ${verse.verse_key}`, err.message);
    }
  }
}

// MAIN EXECUTION
async function main() {
  console.log("=== Bismillah, Starting AI Embedding Generation ===");
  // We'll test with Surah 1 (Al-Fatihah) first!
  const START_SURAH = 1;
  const END_SURAH = 1;
  
  for (let i = START_SURAH; i <= END_SURAH; i++) {
     await processSurah(i);
  }
  
  console.log("\n✅ Test Generation Complete! Check Supabase to guarantee rows are written.");
}

main().catch(console.error);
