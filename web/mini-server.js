const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Test</title></head>
<body style="font-family:Arial;padding:20px">
<h1>✅ SERVEUR OK</h1>
<p>Le serveur fonctionne correctement !</p>
</body>
</html>
`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3200;
server.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log('Serveur démarré SUR LE PORT ' + PORT);
  console.log('Ouvre http://localhost:' + PORT);
  console.log('=================================');
});