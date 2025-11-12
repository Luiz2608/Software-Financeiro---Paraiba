const { SentenceTransformer } = require('sentence-transformers');
const faiss = require('faiss-node');
const fs = require('fs');

class EmbeddingSearch {
    constructor() {
        this.model = new SentenceTransformer('all-MiniLM-L6-v2');
        this.index = null;
        this.docs = [];
    }

    async carregarBase() {
        if (fs.existsSync('embeddings.json')) {
            const data = JSON.parse(fs.readFileSync('embeddings.json', 'utf8'));
            this.docs = data.docs;
            this.index = faiss.IndexFlatL2.fromArray(new Float32Array(data.embeddings), data.embeddings[0].length);
            console.log('✅ Base de embeddings carregada.');
        } else {
            console.log('⚠️ Nenhuma base de embeddings encontrada.');
        }
    }

    async gerarBase(docs) {
        const embeddings = await this.model.encode(docs);
        this.index = new faiss.IndexFlatL2(embeddings[0].length);
        this.index.add(embeddings);
        fs.writeFileSync('embeddings.json', JSON.stringify({ docs, embeddings }));
        console.log('✅ Base de embeddings gerada e salva.');
    }

    async buscar(query, topK = 3) {
        if (!this.index) return [];
        const queryEmb = await this.model.encode([query]);
        const { distances, labels } = this.index.search(queryEmb, topK);
        return labels[0].map(i => this.docs[i]);
    }
}

module.exports = new EmbeddingSearch();
