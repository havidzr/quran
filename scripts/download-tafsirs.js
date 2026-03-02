const fs = require('fs');
const https = require('https');
const path = require('path');

const outputDir = path.join(__dirname, '../public/data/tafsir');
['kemenag', 'tahlili'].forEach((dir) => {
  const d = path.join(outputDir, dir);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on('error', reject);
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadSurah(surahId) {
  try {
    const gading = await fetchJson(`https://api.quran.gading.dev/surah/${surahId}`);
    if (gading && gading.data && gading.data.verses) {
      const kemenagData = {};
      const tahliliData = {};

      gading.data.verses.forEach((v) => {
        if (v.tafsir && v.tafsir.id) {
          kemenagData[v.number.inSurah] = v.tafsir.id.short;
          tahliliData[v.number.inSurah] = v.tafsir.id.long;
        }
      });

      fs.writeFileSync(
        path.join(outputDir, `kemenag/${surahId}.json`),
        JSON.stringify(kemenagData, null, 2),
      );
      fs.writeFileSync(
        path.join(outputDir, `tahlili/${surahId}.json`),
        JSON.stringify(tahliliData, null, 2),
      );
      process.stdout.write('.');
    } else {
      console.log(`\nFailed to parse Surah ${surahId}`);
    }
  } catch (err) {
    console.error(`\nError downloading Surah ${surahId}:`, err.message);
  }
}

async function run() {
  console.log('Retrying download for Surah 79...');
  await downloadSurah(79);
  console.log('\nDownload complete!');
}

run();
