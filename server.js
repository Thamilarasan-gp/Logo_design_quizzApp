// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection with better error handling and logging
mongoose.connect('mongodb+srv://thamilprakasam2005:appichithamil@cluster0.qqwny.mongodb.net/practice', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully to quizDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define Schema with validation
const resultSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    score: { 
        type: Number, 
        required: true,
        min: 0,
        max: 5
    },
    completionTime: {
        type: Number,
        required: true,
        min: 0
    },
    entryTime: {      // Add entry time
        type: Date,
        required: true
    },
    submittedAt: {
        type: Date,
        required: true,
        // Remove the default value to ensure each entry gets its own timestamp
    }
});

const Result = mongoose.model('Result', resultSchema);

// Modified save result endpoint
app.post('/api/save-result', async (req, res) => {
    try {
        const { name, score, completionTime, entryTime } = req.body;
        console.log('Received save request:', { name, score, completionTime, entryTime });

        if (!name || score === undefined || !completionTime || !entryTime) {
            throw new Error('Required fields are missing');
        }

        // Create a new result with current timestamp
        const currentTime = new Date();
        console.log('Saving with timestamp:', currentTime);

        const result = new Result({
            name,
            score,
            completionTime,
            entryTime: new Date(entryTime),
            submittedAt: currentTime
        });

        await result.save();
        console.log('Result saved successfully:', result);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Save result error:', error);
        res.status(500).json({ 
            error: 'Failed to save result',
            details: error.message 
        });
    }
});

// Modified leaderboard endpoint to sort by recent submissions first
app.get('/api/leaderboard', async (req, res) => {
    try {
        console.log('Fetching leaderboard...');
        
        const results = await Result.find()
            .sort({ submittedAt: -1 }) // Sort by submission time (most recent first)
            .limit(10);
        
        console.log('Found results:', results);
        res.json(results);
    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch leaderboard',
            details: error.message
        });
    }
});

// Add error handling for the server
app.listen(3000, () => {
    console.log('Server running on port 3000');
}).on('error', (err) => {
    console.error('Server error:', err);
});

// Add general error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ 
        error: 'Server error', 
        details: err.message 
    });
});
