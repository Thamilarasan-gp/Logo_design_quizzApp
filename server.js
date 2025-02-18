// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
    origin: [
        'https://logo-design-quizz-app-fronntend-luse4lksm.vercel.app',
        'https://logo-design-quizz-app-fronntend.vercel.app',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

// MongoDB connection with better error handling and logging

const uri = "mongodb+srv://thamilprakasam2005:appichithamil@cluster0.qqwny.mongodb.net/practice";

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully to practice DB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Define Schema with validation
const resultSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true ,
        unique: true
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

        // Check if name already exists
        const existingUser = await Result.findOne({ name: name });
        if (existingUser) {
            return res.status(400).json({ 
                error: 'Name already exists',
                message: 'Please choose a different name'
            });
        }

        // Create a new result with current timestamp
        const currentTime = new Date();
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

// Modified leaderboard endpoint to sort by score and completion time
app.get('/api/leaderboard', async (req, res) => {
    try {
        console.log('Fetching leaderboard...');
        
        const results = await Result.find()
            .sort({ 
                score: -1,  // First sort by score (highest first)
                completionTime: 1,  // Then by completion time (lowest first)
                submittedAt: -1  // If score and time are same, show most recent first
            })
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
