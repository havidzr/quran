/* eslint-disable no-console */
/* eslint-disable react-func/max-lines-per-function */
/* eslint-disable @typescript-eslint/naming-convention */
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const BASE_SYSTEM_PROMPT = `Kamu adalah "Quran Tsirwah AI", asisten cerdas Islami resmi dari Tsirwah Pesantren Digital.
Tugas utama kamu adalah membimbing, menjawab pertanyaan, dan memberikan solusi kehidupan berbasis Al-Quran dan As-Sunnah dengan rujukan utama Tafsir Kementerian Agama RI (Kemenag RI) serta kitab-kitab tafsir mu'tabar Ahlussunnah wal Jama'ah (seperti Tafsir Jalalain dan Ibnu Katsir).

Pedoman Menjawab:
1. Karakter & Adab: Bersikap santun, empati, ramah, dan menyejukkan hati (layaknya ustadz/penasihat bijak dari Nahdlatul Ulama / Pesantren Tsirwah).
2. Akurasi Dalil: Wajib mencantumkan referensi surah dan ayat dengan format jelas: (QS. [Nama Surah]: [Nomor Ayat]).
3. Rujukan Tafsir: Jelaskan makna ayat dengan bahasa Indonesia yang mudah dipahami orang awam. Jika disediakan konteks naskah tafsir di bawah, utamakan naskah tersebut.
4. Jangan Berhalusinasi: Jangan pernah mengarang teks ayat atau terjemahan. Jika tidak tahu atau pertanyaannya di luar Al-Quran/syariat, katakan dengan rendah hati.
5. Keamanan: Tolak dengan santun setiap pertanyaan yang provokatif, memicu kebencian, perdebatan kusir, atau melanggar syariat Islam.
`;

// Mapping daftar surah populer untuk pencarian cepat data lokal tafsir
const SURAH_MAP: Record<string, number> = {
  fatihah: 1, 'al-fatihah': 1, alfatikah: 1,
  baqarah: 2, 'al-baqarah': 2,
  aliimran: 3, 'ali imran': 3, 'ali-imran': 3, 'ali 'imran': 3,
  nisa: 4, 'an-nisa': 4, 'an-nisa'': 4,
  maidah: 5, 'al-maidah': 5, 'al-ma'idah': 5,
  anam: 6, 'al-anam': 6, 'al-an'am': 6,
  araf: 7, 'al-araf': 7, 'al-a'raf': 7,
  anfal: 8, 'al-anfal': 8,
  taubah: 9, 'at-taubah': 9, taubat: 9,
  yunus: 10, hud: 11, yusuf: 12, rad: 13, 'ar-rad': 13,
  ibrahim: 14, hijr: 15, 'al-hijr': 15,
  nahl: 16, 'an-nahl': 16, isra: 17, 'al-isra': 17,
  kahfi: 18, 'al-kahfi': 18, kahf: 18, 'al-kahf': 18,
  maryam: 19, taha: 20, anbiya: 21, 'al-anbiya': 21,
  hajj: 22, 'al-hajj': 22, muminun: 23, 'al-mu'minun': 23,
  nur: 24, 'an-nur': 24, furqan: 25, 'al-furqan': 25,
  syuara: 26, 'asy-syu'ara': 26, naml: 27, 'an-naml': 27,
  qashash: 28, 'al-qashash': 28, ankabut: 29, 'al-ankabut': 29,
  rum: 30, 'ar-rum': 30, luqman: 31, sajdah: 32, 'as-sajdah': 32,
  ahzab: 33, 'al-ahzab': 33, saba: 34, fatir: 35,
  yasin: 36, yasiin: 36, shaffat: 37, 'ash-shaffat': 37,
  shad: 38, zumar: 39, 'az-zumar': 39, ghafir: 40,
  fussilat: 41, syura: 42, 'asy-syura': 42, zukhruf: 43, 'az-zukhruf': 43,
  dukhan: 44, 'ad-dukhan': 44, jatsiyah: 45, 'al-jatsiyah': 45,
  ahqaf: 46, 'al-ahqaf': 46, muhammad: 47, fath: 48, 'al-fath': 48,
  hujurat: 49, 'al-hujurat': 49, qaf: 50, dzariyat: 51, 'adz-dzariyat': 51,
  thur: 52, 'ath-thur': 52, najm: 53, 'an-najm': 53,
  qamar: 54, 'al-qamar': 54, rahman: 55, 'ar-rahman': 55,
  waqiah: 56, 'al-waqiah': 56, 'al-waqi'ah': 56, hadid: 57, 'al-hadid': 57,
  mujadilah: 58, 'al-mujadilah': 58, hasyr: 59, 'al-hasyr': 59,
  mumtahanah: 60, 'al-mumtahanah': 60, shaff: 61, 'ash-shaff': 61,
  jumuah: 62, 'al-jumuah': 62, 'al-jumu'ah': 62, munafiqun: 63, 'al-munafiqun': 63,
  taghabun: 64, 'at-taghabun': 64, thalaq: 65, 'ath-thalaq': 65,
  tahrim: 66, 'at-tahrim': 66, mulk: 67, 'al-mulk': 67,
  qalam: 68, 'al-qalam': 68, haqqah: 69, 'al-haqqah': 69,
  maarij: 70, 'al-ma'arij': 70, nuh: 71, jin: 72, 'al-jinn': 72,
  muzammil: 73, 'al-muzammil': 73, muddatstsir: 74, 'al-muddatstsir': 74,
  qiyamah: 75, 'al-qiyamah': 75, insan: 76, 'al-insan': 76,
  mursalat: 77, 'al-mursalat': 77, naba: 78, 'an-naba': 78,
  naziat: 79, 'an-nazi'at': 79, abasa: 80, takwir: 81, 'at-takwir': 81,
  infithar: 82, 'al-infithar': 82, muthaffifin: 83, 'al-muthaffifin': 83,
  insyiqaq: 84, 'al-insyiqaq': 84, buruj: 85, 'al-buruj': 85,
  thariq: 86, 'ath-thariq': 86, ala: 87, 'al-a'la': 87,
  ghasyiyah: 88, 'al-ghasyiyah': 88, fajr: 89, 'al-fajr': 89,
  balad: 90, 'al-balad': 90, syams: 91, 'asy-syams': 91,
  lail: 92, 'al-lail': 92, dhuha: 93, 'adh-dhuha': 93,
  insyirah: 94, 'al-insyirah': 94, tin: 95, 'at-tin': 95,
  alaq: 96, 'al-\'alaq': 96, qadr: 97, 'al-qadr': 97,
  bayyinah: 98, 'al-bayyinah': 98, zalzalah: 99, 'az-zalzalah': 99,
  adiyat: 100, 'al-\'adiyat': 100, qariah: 101, 'al-qari'ah': 101,
  takatsur: 102, 'at-takatsur': 102, ashr: 103, 'al-\'ashr': 103,
  humazah: 104, 'al-humazah': 104, fil: 105, 'al-fil': 105,
  quraisy: 106, maun: 107, 'al-ma'un': 107,
  kautsar: 108, 'al-kautsar': 108, kafirun: 109, 'al-kafirun': 109,
  nashr: 110, 'an-nashr': 110, lahab: 111, 'al-lahab': 111,
  ikhlas: 112, 'al-ikhlas': 112, falaq: 113, 'al-falaq': 113,
  nas: 114, 'an-nas': 114,
};

function getLocalTafsirContext(queryText: string): string {
  try {
    const textLower = queryText.toLowerCase();

    // Deteksi nomor surah atau nama surah
    let matchedSurahId: number | null = null;
    let matchedAyah: string | null = null;

    // Cek apakah ada nomor surah langsung, cth: "surat 1 ayat 2" atau "QS 2:255"
    const qsNumMatch = textLower.match(/(?:surat|surah|qs|q.s.?)s*(d{1,3})(?:[:s]+ayats*(d{1,3})|[:s]+(d{1,3}))?/i);
    if (qsNumMatch && qsNumMatch[1]) {
      const num = parseInt(qsNumMatch[1], 10);
      if (num >= 1 && num <= 114) {
        matchedSurahId = num;
        matchedAyah = qsNumMatch[2] || qsNumMatch[3] || null;
      }
    }

    // Jika belum ketemu, cek nama surah
    if (!matchedSurahId) {
      for (const [name, surahNum] of Object.entries(SURAH_MAP)) {
        const regex = new RegExp(`\\b${name}\\b`, 'i');
        if (regex.test(textLower)) {
          matchedSurahId = surahNum;
          // Cari ayat
          const ayahMatch = textLower.match(/(?:ayat|ke-?|:)s*(d{1,3})/i);
          if (ayahMatch) {
            matchedAyah = ayahMatch[1];
          }
          break;
        }
      }
    }

    if (matchedSurahId) {
      const kemenagPath = path.join(
        process.cwd(),
        'public',
        'data',
        'tafsir',
        'kemenag',
        `${matchedSurahId}.json`,
      );

      if (fs.existsSync(kemenagPath)) {
        const kemenagData = JSON.parse(fs.readFileSync(kemenagPath, 'utf8'));
        if (matchedAyah && kemenagData[matchedAyah]) {
          return `[Tafsir Kemenag RI Surah ${matchedSurahId} Ayat ${matchedAyah}]:\n${kemenagData[matchedAyah]}`;
        }

        // Jika tidak spesifik ayat, ambil ringkasan ayat 1-5
        const previewAyahs = Object.entries(kemenagData)
          .slice(0, 5)
          .map(([aNum, txt]) => `Ayat ${aNum}: ${txt}`)
          .join('\n');
        return `[Tafsir Kemenag RI Surah ${matchedSurahId}]:\n${previewAyahs}`;
      }
    }
  } catch (err) {
    console.warn('Gagal membaca tafsir lokal:', err);
  }

  return '';
}

// Handler streaming DeepSeek (OpenAI-compatible)
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
      temperature: 0.5,
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
          // Abaikan partial json chunk
        }
      }
    }
  }

  res.end();
}

// Handler streaming Gemini (Google Generative AI)
async function streamGemini(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  res: any,
) {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  });

  const chatHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1]?.content || '';
  const chat = model.startChat({ history: chatHistory });
  const geminiStream = await chat.sendMessageStream(lastMessage);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  for await (const chunk of geminiStream.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      res.write(chunkText);
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
      systemPrompt += `\n\n[Konteks Data Tafsir Kemenag Terkait]:\n${localTafsir}\nSilakan jadikan naskah di atas sebagai rujukan akurat.\n`;
    }

    // Prioritas 1: DeepSeek jika DEEPSEEK_API_KEY tersedia
    if (DEEPSEEK_API_KEY) {
      await streamDeepSeek(systemPrompt, messages, res);
      return;
    }

    // Prioritas 2: Google Gemini jika GEMINI_API_KEY tersedia
    if (GEMINI_API_KEY) {
      await streamGemini(systemPrompt, messages, res);
      return;
    }

    // Jika belum ada API key yang dikonfigurasi
    res.status(500).json({
      message: 'API Key AI belum dikonfigurasi di Environment Variable (DEEPSEEK_API_KEY atau GEMINI_API_KEY).',
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Terjadi kesalahan pada server AI' });
    } else {
      res.end();
    }
  }
}
