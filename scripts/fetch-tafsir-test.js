const https = require('https');

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
            resolve({ error: 'Parse error', data: data.substring(0, 100) });
          }
        });
      })
      .on('error', reject);
  });
}

async function main() {
  console.log('Checking api.myquran.com API...');
  const myquran = await fetchJson('https://api.myquran.com/v2/quran/tafsir/jalalayn/1');
  console.log('myquran keys:', Object.keys(myquran));
  if (myquran.data) {
    console.log('myquran data keys:', Object.keys(myquran.data));
    if (myquran.data.tafsir) {
      console.log('myquran tafsir keys:', Object.keys(myquran.data.tafsir[0]));
      console.log('myquran jalalayn sample:', myquran.data.tafsir[0].text);
    }
  }
}
main();
