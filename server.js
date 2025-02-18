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

// Add batch schedules and management
const batchSchedules = {
    'batch1': { start: '09:00', duration: 60 }, // 9 AM - 10 AM
    'batch2': { start: '10:00', duration: 60 }, // 10 AM - 11 AM
    'batch3': { start: '11:00', duration: 60 }, // 11 AM - 12 PM
    'batch4': { start: '12:00', duration: 60 }  // 12 PM - 1 PM
};

// Batch Schema
const batchSchema = new mongoose.Schema({
    batchId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['active', 'completed'],
        default: 'active'
    },
    startTime: Date,
    endTime: Date
});

const Batch = mongoose.model('Batch', batchSchema);

// Function to validate batch time
function isBatchTimeValid(batchId) {
    const currentTime = new Date();
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    const batch = batchSchedules[batchId];
    if (!batch) return false;

    const [startHours, startMinutes] = batch.start.split(':').map(Number);
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = startTimeInMinutes + batch.duration;

    return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
}

// Update Result schema to include batchId
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
    batchId: {
        type: String,
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

// Create indexes for better query performance
resultSchema.index({ name: 1, batchId: 1 }, { unique: true });

const Result = mongoose.model('Result', resultSchema);

// Endpoint to check name availability and batch validity
app.post('/api/check-name', async (req, res) => {
    try {
        const { name } = req.body;
        const { batchId } = req.query;
        
        if (!name || !batchId) {
            return res.status(400).json({
                error: 'Missing required fields',
                message: 'Name and batch ID are required'
            });
        }

        // Validate batch timing
        if (!isBatchTimeValid(batchId)) {
            return res.status(403).json({
                error: 'Invalid batch time',
                message: `Batch ${batchId} is not currently active`
            });
        }

        // Check if name exists in this batch
        const existingUser = await Result.findOne({ 
            name: name,
            batchId: batchId
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Name exists in batch',
                message: 'You have already participated in this batch'
            });
        }

        res.json({ success: true, message: 'Name is available for this batch' });
    } catch (error) {
        console.error('Name check error:', error);
        res.status(500).json({
            error: 'Failed to check name',
            details: error.message
        });
    }
});

// Update save-result endpoint to include batch validation
app.post('/api/save-result', async (req, res) => {
    try {
        const { name, score, completionTime, entryTime, batchId } = req.body;

        if (!batchId) {
            return res.status(400).json({
                error: 'Missing batch ID',
                message: 'Please use the correct batch link'
            });
        }

        // Validate batch timing
        if (!isBatchTimeValid(batchId)) {
            return res.status(403).json({
                error: 'Invalid batch time',
                message: 'This batch is not currently active'
            });
        }

        const result = new Result({
            name,
            score,
            completionTime,
            batchId,
            entryTime: new Date(entryTime),
            submittedAt: new Date()
        });

        await result.save();
        res.json({ success: true, result });
    } catch (error) {
        console.error('Save result error:', error);
        res.status(500).json({
            error: 'Failed to save result',
            details: error.message
        });
    }
});

// Update leaderboard endpoint to include batch filtering
app.get('/api/leaderboard', async (req, res) => {
    try {
        const { batchId } = req.query;
        const query = batchId ? { batchId } : {};
        
        const results = await Result.find(query)
            .sort({
                score: -1,
                completionTime: 1,
                submittedAt: -1
            })
            .limit(10);
        
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
