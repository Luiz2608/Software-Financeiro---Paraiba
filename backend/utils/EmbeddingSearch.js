const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");

// Usa o Gemini para gerar embeddings
class EmbeddingSearch {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.docs = [];
        this.embeddings = [];
        const key = process.env.GEMINI_API_KEY;
        if (key) {
            this.setApiKey(key);
        }
    }

    setApiKey(apiKey) {
        if (!apiKey) return;
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "embedding-001" });
    }

    async carregarBase() {
        if (fs.existsSync("embeddings.json")) {
            const data = JSON.parse(fs.readFileSync("embeddings.json", "utf8"));
            this.docs = data.docs;
            this.embeddings = data.embeddings;
            console.log("✅ Base de embeddings carregada (Gemini).");
        } else {
            console.log("⚠️ Nenhum arquivo embeddings.json encontrado. Gere a base inicial com setupEmbeddings.js");
        }
    }

    async gerarEmbedding(texto) {
        if (!this.model) {
            const key = process.env.GEMINI_API_KEY;
            if (key) this.setApiKey(key);
        }
        if (!this.model) throw new Error('Modelo de embeddings não inicializado');
        const result = await this.model.embedContent(texto);
        return result.embedding.values;
    }

    async gerarBase(docs) {
        console.log("🔹 Gerando embeddings com Gemini...");
        const embeddings = [];
        for (const doc of docs) {
            const emb = await this.gerarEmbedding(doc);
            embeddings.push(emb);
        }
        fs.writeFileSync("embeddings.json", JSON.stringify({ docs, embeddings }));
        console.log("✅ Base de embeddings gerada (embeddings.json).");
    }

    // Busca por similaridade via cosseno
    async buscar(query, topK = 3) {
        if (this.docs.length === 0) {
            console.log("⚠️ Nenhuma base carregada para busca vetorial.");
            return [];
        }

        const queryEmbedding = await this.gerarEmbedding(query);

        const cosineSim = (a, b) => {
            const dot = a.reduce((acc, v, i) => acc + v * b[i], 0);
            const magA = Math.sqrt(a.reduce((acc, v) => acc + v * v, 0));
            const magB = Math.sqrt(b.reduce((acc, v) => acc + v * v, 0));
            return dot / (magA * magB);
        };

        const scores = this.embeddings.map((emb, i) => ({
            index: i,
            score: cosineSim(emb, queryEmbedding)
        }));

        scores.sort((a, b) => b.score - a.score);
        const topDocs = scores.slice(0, topK).map(s => this.docs[s.index]);

        return topDocs;
    }
}

module.exports = new EmbeddingSearch();
