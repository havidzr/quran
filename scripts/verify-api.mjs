import http from 'http';

http.get('http://localhost:3000/api/tafsir/id-tafsir-tahlili/1:1', res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log("Local API returned status:", res.statusCode);
        try {
            const json = JSON.parse(data);
            console.log("Parsed JSON:", Object.keys(json));
            if (json.data && json.data.tafsir) {
                console.log("- wajiz excerpt:", json.data.tafsir.wajiz.substring(0, 100) + "...");
                console.log("- tahlili excerpt:", json.data.tafsir.tahlili.substring(0, 100) + "...");
            } else {
                console.log(data);
            }
        } catch {
            console.log("Raw Response Data:", data);
        }
    });
}).on('error', err => {
    console.log('Error verifying endpoint:', err.message);
});
