/* eslint-disable no-console */
/* eslint-disable react-func/max-lines-per-function */
/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

const BASE_SYSTEM_PROMPT = `Kamu adalah "Quran Tsirwah AI", asisten cerdas Islami resmi dari Tsirwah Pesantren Digital.
Tugas utama kamu adalah membimbing, menjawab pertanyaan, dan memberikan solusi kehidupan berbasis Al-Quran dan As-Sunnah dengan rujukan utama Tafsir Kementerian Agama RI (Kemenag RI) serta kitab-kitab tafsir mu'tabar Ahlussunnah wal Jama'ah (seperti Tafsir Jalalain dan Tafsir Ibnu Katsir).

Pedoman Utama Format Jawaban (WAJIB DIIKUTI):
1. Karakter & Adab:
   - Bersikap santun, empati, ramah, dan menyejukkan hati (layaknya ustadz/penasihat bijak dari Nahdlatul Ulama / Pesantren Tsirwah).
   - Awali dengan sapaan hangat yang menenangkan jika sesuai konteks.

2. Teks Asli Ayat Al-Qur'an (WAJIB):
   - Setiap kali mengutip ayat, WAJIB menyertakan teks atau potongan ayat asli dalam BAHASA ARAB BERHARAKAT (Rasm Uthmani) yang benar dan indah.

3. Tautan Link ke Halaman Mushaf Tsirwah (WAJIB):
   - Setiap kali menyebutkan ayat, sertakan tautan langsung ke halaman ayat tersebut dengan format markdown internal:
     [Buka QS. NamaSurat: NomorAyat](/<nomorSurat>/<nomorAyat>)
     Contoh: [Buka QS. At-Taubah: 40](/9/40) atau [Buka QS. Al-Baqarah: 286](/2/286).

4. Struktur Setiap Poin Ayat:
   Gunakan struktur rapi berikut untuk setiap ayat yang dibahas:
   **[Nomor]. [Judul Pesan Utama]**
   [Teks Arab Berharakat]
   > "[Terjemahan resmi ayat dalam bahasa Indonesia]"
   👉 [Buka QS. NamaSurat: NomorAyat](/<nomorSurat>/<nomorAyat>)
   [Uraian hikmah/tafsir singkat yang menyejukkan hati]

5. Panjang Jawaban yang Proporsional:
   - Pilih 2 sampai 3 ayat paling relevan dan mendalam agar penjelasan padat, berbobot, dan nyaman dibaca di layar smartphone.

6. Rekomendasi Pertanyaan Lanjutan (Di akhir jawaban):
   - Di baris paling akhir setelah kesimpulan, berikan tepat 2 saran pertanyaan lanjutan dengan format persis:
     Rekomendasi Lanjutan:
     - [Pertanyaan lanjutan 1]
     - [Pertanyaan lanjutan 2]

7. Integritas:
   - Jangan pernah mengarang ayat atau terjemahan. Jika tidak ada dalil spesifik, jelaskan dengan nasihat bijak umum.
`;

function getLocalTafsirContext(queryText: string): string {
  try {
    const textLower = queryText.toLowerCase().replace(/['"`]/g, '');

    // 1. Coba deteksi pola angka: "surah 2 ayat 255" atau "qs 2:255"
    const qsNumMatch = textLower.match(/(?:surat|surah|qs|q\.s\.?)\s*(\d{1,3})(?:[:\s]+ayat\s*(\d{1,3})|[:\s]+(\d{1,3}))?/i);
    let matchedSurahId: number | null = null;
    let matchedAyah: string | null = null;

    if (qsNumMatch && qsNumMatch[1]) {
      const num = parseInt(qsNumMatch[1], 10);
      if (num >= 1 && num <= 114) {
        matchedSurahId = num;
        matchedAyah = qsNumMatch[2] || qsNumMatch[3] || null;
      }
    }

    // 2. Jika belum ketemu, cari berdasarkan nama surah dari data/chapters/id.json
    if (!matchedSurahId) {
      const chaptersPath = path.join(process.cwd(), 'data', 'chapters', 'id.json');
      if (fs.existsSync(chaptersPath)) {
        const chapters = JSON.parse(fs.readFileSync(chaptersPath, 'utf8'));
        const cleanQuery = textLower.replace(/[^a-z0-9]/g, '');
        for (const [idStr, chap] of Object.entries<any>(chapters)) {
          const rawName = (chap.transliteratedName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (rawName && cleanQuery.includes(rawName)) {
            matchedSurahId = parseInt(idStr, 10);
            const ayahMatch = textLower.match(/(?:ayat|ke-?|:)\s*(\d{1,3})/i);
            if (ayahMatch) {
              matchedAyah = ayahMatch[1];
            }
            break;
          }
        }
      }
    }

    if (matchedSurahId) {
      const kemenagPath = path.join(process.cwd(), 'public', 'data', 'tafsir', 'kemenag', `${matchedSurahId}.json`);
      if (fs.existsSync(kemenagPath)) {
        const kemenagData = JSON.parse(fs.readFileSync(kemenagPath, 'utf8'));
        if (matchedAyah && kemenagData[matchedAyah]) {
          return `[Tafsir Kemenag RI Surah ${matchedSurahId} Ayat ${matchedAyah}]:\n${kemenagData[matchedAyah]}`;
        }
        const sample = Object.entries(kemenagData).slice(0, 3).map(([a, txt]) => `Ayat ${a}: ${txt}`).join('\n');
        return `[Tafsir Kemenag RI Surah ${matchedSurahId}]:\n${sample}`;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca tafsir lokal:', err);
  }
  return '';
}

// Handler streaming Gemini dengan model generasi terbaru (2.5-flash / 2.0-flash)
async function streamGemini(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  res: any,
) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const chatHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1]?.content || '';

  // Rantai prioritas model: gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-pro
  const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  let stream: any = null;
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const chat = model.startChat({ history: chatHistory });
      stream = await chat.sendMessageStream(lastMessage);
      break;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${modelName} tidak tersedia, mencoba model berikutnya...`);
    }
  }

  if (!stream) {
    throw lastError || new Error('Gagal menginisialisasi model Gemini');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  for await (const chunk of stream.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      res.write(chunkText);
    }
  }

  res.end();
}

// Handler streaming DeepSeek (sebagai alternatif/fallback)
async function streamDeepSeek(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  res: any,
) {
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    })),
  ];

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: apiMessages,
      stream: true,
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API Error (${response.status}): ${errText}`);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed === 'data: [DONE]') break;
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json.choices?.[0]?.delta?.content;
          if (content) {
            res.write(content);
          }
        } catch {
          // Abaikan partial json
        }
      }
    }
  }

  res.end();
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ message: 'Invalid messages array' });
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const localTafsir = getLocalTafsirContext(lastMessage.content);

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (localTafsir) {
      systemPrompt += `\n\n[Konteks Data Tafsir Kemenag Terkait]:\n${localTafsir}\nSilakan jadikan naskah resmi di atas sebagai rujukan utama.\n`;
    }

    // Prioritas 1: Google Gemini (Gemini 2.5) jika GEMINI_API_KEY tersedia
    if (GEMINI_API_KEY) {
      await streamGemini(systemPrompt, messages, res);
      return;
    }

    // Prioritas 2: DeepSeek jika DEEPSEEK_API_KEY tersedia
    if (DEEPSEEK_API_KEY) {
      await streamDeepSeek(systemPrompt, messages, res);
      return;
    }

    // Jika belum ada API key
    res.status(500).json({
      message: 'GEMINI_API_KEY atau DEEPSEEK_API_KEY belum dikonfigurasi di Environment Variable Vercel.',
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error?.message || 'Terjadi kesalahan pada server AI' });
    } else {
      res.end();
    }
  }
}
