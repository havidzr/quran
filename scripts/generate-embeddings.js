// scripts/generate-embeddings.js
import { HfInference } from '@huggingface/inference';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env.local') });

// Setup HuggingFace and Supabase
// We'll use a model that outputs 384 dimensions. Ensure Supabase uses vector(384)
// Fallback key if the user doesn't have one (a general free tier one for testing)
const hfKey = process.env.HF_TOKEN; 
const hf = new HfInference(hfKey);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if(!supabaseUrl || !supabaseKey) {
  console.error("FATAL: Missing Supabase URL or Key in .env.local");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const DATA_DIR = path.join(projectRoot, 'public/data');
const TAFSIR_KEMENAG_ID = 14;

function chunkText(text, maxLen = 800) {
  if (!text) return [];
  const cleanText = text.replace(/<\/?[^>]+(>|$)/g, ""); // strip html
  const chunks = [];
  let currentChunk = "";
  
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
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

// HuggingFace embedding generator
async function getHFEmbedding(text) {
    try {
        const output = await hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: text,
        });
        return output; // Array of 384 numbers
    } catch(e) {
         console.warn("HF Failed. Retrying...", e.message);
         // simple retry
         await new Promise(r => setTimeout(r, 1000));
         const out2 = await hf.featureExtraction({
            model: "sentence-transformers/all-MiniLM-L6-v2",
            inputs: text,
        });
        return out2;
    }
}


async function processSurah(surahId) {
  console.log(`\n============================`);
  console.log(`Processing Surah ${surahId}`);
  console.log(`============================`);
  
  let quranJson;
  try {
      console.log(`Fetching chapter ${surahId} from quran.com API...`);
      const res = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${surahId}?language=id&words=true&translations=33&fields=text_uthmani&per_page=300`);
      if(!res.ok) throw new Error("Quran API returned false status");
      quranJson = await res.json();
  } catch (err) {
      console.error(`Failed to fetch surah ${surahId} from API:`, err.message);
      return;
  }

  const verses = quranJson.verses || [];
  if (verses.length === 0) return;

  const tafsirPath = path.join(DATA_DIR, `tafsir/${TAFSIR_KEMENAG_ID}/${surahId}.json`);
  let tafsirArray = [];
  try {
      if (fs.existsSync(tafsirPath)) {
          const parsed = JSON.parse(fs.readFileSync(tafsirPath, 'utf-8'));
          tafsirArray = parsed.tafsirs || [];
      }
  } catch(e) {
       console.error(`Failed reading local tafsir file for surah ${surahId}`, e.message);
  }

  let successCount = 0;
  
  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i];
    const verseNum = parseInt(verse.verse_key.split(':')[1]);
    
    const translationText = verse.translations && verse.translations[0] ? verse.translations[0].text : "";
    const arabicContent = verse.text_uthmani || "";
    const baseContent = `Surat ${surahId} Ayat ${verseNum}\nArab: ${arabicContent}\nTerjemahan: ${translationText.replace(/<\/?[^>]+(>|$)/g, "")}`;
    
    const chunksToEmbed = [{ content: baseContent, isTafsir: false }];

    const tData = tafsirArray.find(t => t.verse_id === verse.id) || tafsirArray[i]; 
    if (tData && tData.text) {
        const generatedChunks = chunkText(`Tafsir Kemenag Surat ${surahId} Ayat ${verseNum}: ${tData.text}`, 1000);
        for(const c of generatedChunks) {
             chunksToEmbed.push({ content: c, isTafsir: true });
        }
    }

    console.log(`Processing Verse ${verse.verse_key} (Total ${chunksToEmbed.length} chunks)...`);

    for (const chunkObj of chunksToEmbed) {
         try {
             const embeddingArray = await getHFEmbedding(chunkObj.content);
             
             if (!embeddingArray || embeddingArray.length === 0) {
                 console.error(`❌ Empty embedding returned by API for [${verse.verse_key}]`);
                 continue;
             }

             const { error } = await supabase
              .from('quran_embeddings')
              .insert({
                content: chunkObj.content,
                surah_id: surahId,
                verse_id: verseNum,
                tafsir_id: chunkObj.isTafsir ? TAFSIR_KEMENAG_ID : null,
                embedding: embeddingArray
              });

             if (error) {
                 console.error(`❌ DB error on [${verse.verse_key}]:`, error.message);
                 if(error.message.includes('dimension')) {
                      console.error(`🚨 CRITICAL: Your Supabase vector dimension is wrong. It must be 384 for HuggingFace. Please re-run the updated SQL script.`);
                      process.exit(1);
                 }
             } else {
                 successCount++;
             }

             // Wait 250ms
             await new Promise(r => setTimeout(r, 250));

         } catch (err) {
             console.error(`🚨 Fatal Error on ${verse.verse_key}:`, err.message);
         }
    }
  }
  
  console.log(`\nSurah ${surahId} Processing: ${successCount} chunks successfully upserted.`);
}

// MAIN EXECUTION
async function main() {
  console.log("=== Bismillah, Starting AI Embedding Generation ===");
  // Process all 114 Surahs
  const START_SURAH = 1;
  const END_SURAH = 114; 
  
  for (let i = START_SURAH; i <= END_SURAH; i++) {
     await processSurah(i);
  }
  console.log("\n✅ Test Generation Complete! Check Supabase database.");
}

main().catch(console.error);
