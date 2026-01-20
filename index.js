// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

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
    const apiKey = process.env.NEWS_API_KEY;

    try {
        // Step 1: Try Top Headlines first
        let response = await axios.get(`https://newsapi.org/v2/top-headlines`, {
            params: { country, apiKey }
        });

        let articles = response.data.articles;

        // Step 2: Fallback if Top Headlines are empty
        if (articles.length === 0) {
            // console.log(`No top headlines for ${country}. Falling back to search...`);

            const fullName = countryNames[country] || country;

            const fallbackResponse = await axios.get(`https://newsapi.org/v2/everything`, {
                params: {
                    q: fullName,
                    sortBy: 'publishedAt',
                    pageSize: 20, // Keep it limited
                    apiKey: apiKey
                }
            });
            articles = fallbackResponse.data.articles;
        }

        // console.log(`Sending ${articles.length} articles for ${country}`);
        res.json(articles);

    } catch (error) {
        // console.error("Error:", error.response?.data || error.message);
        res.status(500).json({ error: "API Error" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));