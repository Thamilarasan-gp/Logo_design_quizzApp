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

// Add batch schedules with AM/PM format
const batchSchedules = {
    '1Ace3': { start: '10:50 PM', duration: 5 }, // 10:50 PM - 10:55 PM
    '2rgg4': { start: '10:55 PM', duration: 5 }, // 10:55 PM - 11:00 PM
    '3Hce5': { start: '11:00 PM', duration: 5 }, // 11:00 PM - 11:05 PM
    '4Kce6': { start: '11:05 PM', duration: 5 }  // 11:05 PM - 11:10 PM
};

// Function to validate batch time
function isBatchTimeValid(batchId) {
    const currentTime = new Date();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const batch = batchSchedules[batchId];
    if (!batch) {
        console.log('Invalid batch ID:', batchId);
        return false;
    }

    // Parse AM/PM time
    const [time, period] = batch.start.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    // Convert to 24-hour format for PM times
    if (period === 'PM') {
        if (hours !== 12) {
            hours += 12;
        }
    } else if (period === 'AM' && hours === 12) {
        hours = 0;
    }

    const startTimeInMinutes = hours * 60 + minutes;
    const endTimeInMinutes = startTimeInMinutes + batch.duration;

    console.log('Batch validation details:');
    console.log('Current time:', currentTime.toLocaleTimeString());
    console.log('Current time (minutes):', currentTimeInMinutes);
    console.log('Batch start:', batch.start);
    console.log('Start time (minutes):', startTimeInMinutes);
    console.log('End time (minutes):', endTimeInMinutes);
    console.log('Duration:', batch.duration);

    // Check if current time is within the batch window
    const isValid = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
    console.log('Is valid:', isValid);

    return isValid;
}

// Add session tracking
const activeQuizSessions = new Map();

// Modified save result endpoint
app.post('/api/save-result', async (req, res) => {
    try {
        const { name, score, completionTime, entryTime, batchId } = req.body;
        
        const sessionKey = `${name}_${batchId}`;
        const session = activeQuizSessions.get(sessionKey);

        if (!session) {
            return res.status(400).json({
                error: 'Invalid session',
                message: 'No active quiz session found'
            });
        }

        const result = new Result({
            name,
            score,
            completionTime,
            batchId,
            quizStartTime: session.startTime,
            entryTime: new Date(entryTime),
            submittedAt: new Date()
        });

        await result.save();
        
        // Clear session after saving
        activeQuizSessions.delete(sessionKey);
        
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
