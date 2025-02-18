// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const moment = require('moment-timezone');
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
        required: true,
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
    batchId: {
        type: String,
        required: true
    },
    quizStartTime: {      // Add quiz start time
        type: Date,
        required: true
    },
    entryTime: {
        type: Date,
        required: true
    },
    submittedAt: {
        type: Date,
        required: true
    }
});

const Result = mongoose.model('Result', resultSchema);

// Update batch schedules with correct times and comments
const batchSchedules = {
    '1Ace3': { start: '23:30', duration: 5 }, // 23:12 - 23:17
    '2rgg4': { start: '23:35', duration: 5 }, // 23:17 - 23:22
    '3Hce5': { start: '23:40', duration: 5 }, // 23:22 - 23:27
    '4Kce6': { start: '23:45', duration: 5 }  // 23:27 - 23:32
};

// Improved time validation with better logging
function isBatchTimeValid(batchId) {
    // Get current time in IST/local timezone

    const currentTime = moment().tz('Asia/Kolkata');
    const currentHours = currentTime.hours();
    const currentMinutes = currentTime.minutes();
    const currentTimeInMinutes = (currentHours * 60) + currentMinutes;

    const batch = batchSchedules[batchId];
    if (!batch) {
        console.log('Invalid batch ID:', batchId);
        return false;
    }

    // Parse start time (24-hour format)
    const [hours, minutes] = batch.start.split(':').map(Number);
    const startTimeInMinutes = (hours * 60) + minutes;
    const endTimeInMinutes = startTimeInMinutes + batch.duration;

    // Detailed logging for debugging
    console.log({
        batchId,
        currentDateTime: currentTime.format('YYYY-MM-DD HH:mm:ss'),
        currentTime: `${currentHours}:${currentMinutes}`,
        currentTimeInMinutes,
        batchStartTime: batch.start,
        startTimeInMinutes,
        endTimeInMinutes,
        duration: batch.duration,
        isWithinWindow: currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes
    });

    // Check if current time is within the batch window (inclusive)
    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
}

// Add test function to verify time validation
function testBatchValidation() {
    console.log('Testing batch validation:');
    Object.keys(batchSchedules).forEach(batchId => {
        const isValid = isBatchTimeValid(batchId);
        console.log(`Batch ${batchId}: ${isValid ? 'ACTIVE' : 'INACTIVE'}`);
    });
}

// Run test on server start
testBatchValidation();

// Add session tracking
const activeQuizSessions = new Map();

// Modified save result endpoint with better error handling
app.post('/api/save-result', async (req, res) => {
    try {
        const { name, score, completionTime, entryTime, batchId } = req.body;
        
        console.log('Received save request:', { name, score, completionTime, entryTime, batchId });

        if (!name || score === undefined || !completionTime || !entryTime || !batchId) {
            console.log('Missing fields:', { name, score, completionTime, entryTime, batchId });
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Please provide all required information'
            });
        }

        // Create and save the result directly
        const result = new Result({
            name,
            score,
            completionTime,
            batchId,
            quizStartTime: new Date(entryTime),
            entryTime: new Date(entryTime),
            submittedAt: new Date()
        });

        await result.save();
        console.log('Result saved successfully:', result);
        
        res.json({ 
            success: true, 
            result,
            message: 'Result saved successfully'
        });
    } catch (error) {
        console.error('Save result error:', error);
        
        // Check for duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                error: 'Result already exists',
                message: 'Your result has already been saved'
            });
        }

        res.status(500).json({ 
            error: 'Failed to save result',
            message: 'Please try again'
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

// Update check-name endpoint to track quiz start time
app.post('/api/check-name', async (req, res) => {
    try {
        const { name } = req.body;
        const { batchId } = req.query;
        
        if (!name) {
            throw new Error('Name is required');
        }

        // Require batchId
        if (!batchId) {
            return res.status(400).json({
                error: 'Missing batch ID',
                message: 'Please use the correct batch link'
            });
        }

        // Validate batch timing
        if (!isBatchTimeValid(batchId)) {
            // Check if user already started quiz in valid time
            const sessionKey = `${name}_${batchId}`;
            if (activeQuizSessions.has(sessionKey)) {
                return res.json({ success: true, message: 'Continue quiz session' });
            }

            return res.status(403).json({
                error: 'Invalid batch time',
                message: 'This batch is not currently active'
            });
        }

        // Check if name already exists
        const existingUser = await Result.findOne({ name: name });
        if (existingUser) {
            return res.status(400).json({ 
                error: 'Name already exists',
                message: 'Please choose a different name'
            });
        }

        // Track quiz start time
        const sessionKey = `${name}_${batchId}`;
        activeQuizSessions.set(sessionKey, {
            startTime: new Date(),
            batchId: batchId
        });

        res.json({ success: true, message: 'Name is available' });
    } catch (error) {
        console.error('Name check error:', error);
        res.status(500).json({ 
            error: 'Failed to check name',
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
