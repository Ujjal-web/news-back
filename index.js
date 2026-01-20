// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());

// ===== MongoDB connection =====
mongoose
    .connect(process.env.MONGO_URI, {
        // optional: pass options based on your driver version
    })
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

// ===== Mongoose model =====
const articleSchema = new mongoose.Schema(
    {
        source: {
            id: String,
            name: String,
        },
        author: String,
        title: String,
        description: String,
        url: { type: String, unique: true }, // use url as unique identifier
        urlToImage: String,
        publishedAt: Date,
        content: String,

        // Metadata for your app
        country: String,
        category: String,
        language: String,
        query: {
            from: Date,
            to: Date,
            sources: String,
        },
        fetchedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

const Article = mongoose.model('Article', articleSchema);


const countryNames = {
    us: "United States",
    gb: "United Kingdom",
    in: "India",
    ca: "Canada",
    au: "Australia",
    de: "Germany",
    fr: "France"
};

app.get('/news/:country', async (req, res) => {
    const { country } = req.params;
    const { category, from, to, language, sources } = req.query;
    const apiKey = process.env.NEWS_API_KEY;

    try {
        let articles = [];

        // If user specified from/to/language, go directly to "everything"
        const needEverythingDirectly = Boolean(from || to || language);

        // 1) Try Top Headlines first (unless from/to/language forces us to use "everything")
        if (!needEverythingDirectly) {
            const topParams = {
                apiKey,
                country,
            };

            // category filter for top-headlines (except "all")
            if (category && category !== 'all') {
                topParams.category = category;
            }

            // If sources is provided, NewsAPI expects only sources (no country/category)
            if (sources) {
                delete topParams.country;
                delete topParams.category;
                topParams.sources = sources; // comma-separated source IDs
            }

            const response = await axios.get(
                'https://newsapi.org/v2/top-headlines',
                { params: topParams }
            );

            articles = response.data.articles || [];
        }

        // 2) Fallback (or direct) to "everything" if:
        //    - top-headlines returned no articles
        //    - OR from/to/language was requested
        if (articles.length === 0) {
            const fullName = countryNames[country] || country;

            const everythingParams = {
                apiKey,
                sortBy: 'publishedAt',
                pageSize: 20,
                q: fullName,
            };

            // Add category as part of search query if not "all"
            if (category && category !== 'all') {
                everythingParams.q += ` AND ${category}`;
            }

            if (language) everythingParams.language = language;
            if (from) everythingParams.from = from; // YYYY-MM-DD is fine
            if (to) everythingParams.to = to;
            if (sources) everythingParams.sources = sources;

            const fallbackResponse = await axios.get(
                'https://newsapi.org/v2/everything',
                { params: everythingParams }
            );
            articles = fallbackResponse.data.articles || [];
        }

        // 3) Store all fetched articles in DB (upsert by URL)
        if (articles.length) {
            const ops = articles.map((a) => ({
                updateOne: {
                    filter: { url: a.url },
                    update: {
                        $set: {
                            source: a.source,
                            author: a.author,
                            title: a.title,
                            description: a.description,
                            url: a.url,
                            urlToImage: a.urlToImage,
                            publishedAt: a.publishedAt,
                            content: a.content,
                            country,
                            category: category || 'all',
                            language: language || null,
                            query: {
                                from: from || null,
                                to: to || null,
                                sources: sources || null,
                            },
                            fetchedAt: new Date(),
                        },
                    },
                    upsert: true,
                },
            }));

            await Article.bulkWrite(ops, { ordered: false });
        }

        // 4) Return articles to frontend
        res.json(articles);
    } catch (error) {
        console.error('Backend Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'API Error' });
    }
});


const PORT = 5000;
// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
module.exports = app;