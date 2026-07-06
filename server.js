const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/articles', require('./routes/articles'));
app.use('/api/ordres', require('./routes/ordres'));
app.use('/api/encours', require('./routes/encours'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/dossiers', require('./routes/dossiers'));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`TextileFlow démarré sur http://localhost:${PORT}`));
