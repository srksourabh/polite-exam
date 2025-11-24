const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Tables
const QUESTIONS_TABLE = 'Questions';
const EXAMS_TABLE = 'Exams';
const RESULTS_TABLE = 'Results';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// Main handler
module.exports = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).json({ success: true });
    }

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    const { url, method } = req;
    const path = url.replace('/api', '');

    try {
        // Health check
        if (path === '/health' && method === 'GET') {
            await base(QUESTIONS_TABLE).select({ maxRecords: 1 }).firstPage();
            return res.status(200).json({ 
                success: true, 
                message: 'Server and database are healthy',
                timestamp: new Date().toISOString()
            });
        }

        // Get all questions
        if (path === '/questions' && method === 'GET') {
            const questions = [];
            await base(QUESTIONS_TABLE).select({
                view: 'Grid view'
            }).eachPage((records, fetchNextPage) => {
                records.forEach(record => {
                    questions.push({
                        id: record.id,
                        ID: record.get('ID'),
                        Subject: record.get('Subject'),
                        Question: record.get('Question'),
                        'Option A': record.get('Option A'),
                        'Option B': record.get('Option B'),
                        'Option C': record.get('Option C'),
                        'Option D': record.get('Option D'),
                        Correct: record.get('Correct')
                    });
                });
                fetchNextPage();
            });
            
            return res.status(200).json({ success: true, questions });
        }

        // Add a new question
        if (path === '/questions' && method === 'POST') {
            const { ID, Subject, Question, OptionA, OptionB, OptionC, OptionD, Correct } = req.body;
            
            if (!Subject || !Question || !OptionA || !OptionB || !OptionC || !OptionD || Correct === undefined) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'All fields are required' 
                });
            }
            
            const record = await base(QUESTIONS_TABLE).create([
                {
                    fields: {
                        ID: ID || `Q${Date.now()}`,
                        Subject: Subject,
                        Question: Question,
                        'Option A': OptionA,
                        'Option B': OptionB,
                        'Option C': OptionC,
                        'Option D': OptionD,
                        Correct: Correct
                    }
                }
            ]);
            
            return res.status(200).json({ 
                success: true, 
                message: 'Question added successfully',
                question: {
                    id: record[0].id,
                    ID: record[0].get('ID'),
                    Subject: record[0].get('Subject'),
                    Question: record[0].get('Question'),
                    'Option A': record[0].get('Option A'),
                    'Option B': record[0].get('Option B'),
                    'Option C': record[0].get('Option C'),
                    'Option D': record[0].get('Option D'),
                    Correct: record[0].get('Correct')
                }
            });
        }

        // Get all exams
        if (path === '/exams' && method === 'GET') {
            const exams = [];
            await base(EXAMS_TABLE).select({
                view: 'Grid view'
            }).eachPage((records, fetchNextPage) => {
                records.forEach(record => {
                    exams.push({
                        id: record.id,
                        'Exam Code': record.get('Exam Code'),
                        'Title': record.get('Title'),
                        'Duration (mins)': record.get('Duration (mins)'),
                        'Expiry (IST)': record.get('Expiry (IST)'),
                        'Questions': record.get('Questions') || []
                    });
                });
                fetchNextPage();
            });
            
            return res.status(200).json({ success: true, exams });
        }

        // Get exam by code
        if (path.startsWith('/exams/') && method === 'GET') {
            const examCode = path.replace('/exams/', '');
            const records = await base(EXAMS_TABLE).select({
                filterByFormula: `{Exam Code} = '${examCode}'`,
                maxRecords: 1
            }).firstPage();
            
            if (records.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Exam not found' 
                });
            }
            
            const record = records[0];
            const questionIds = record.get('Questions') || [];
            
            const questions = [];
            if (questionIds.length > 0) {
                for (const qId of questionIds) {
                    try {
                        const qRecord = await base(QUESTIONS_TABLE).find(qId);
                        questions.push({
                            ID: qRecord.get('ID'),
                            Subject: qRecord.get('Subject'),
                            Question: qRecord.get('Question'),
                            'Option A': qRecord.get('Option A'),
                            'Option B': qRecord.get('Option B'),
                            'Option C': qRecord.get('Option C'),
                            'Option D': qRecord.get('Option D'),
                            Correct: qRecord.get('Correct')
                        });
                    } catch (err) {
                        console.warn('Could not fetch question:', qId);
                    }
                }
            }
            
            const exam = {
                id: record.id,
                'Exam Code': record.get('Exam Code'),
                'Title': record.get('Title'),
                'Duration (mins)': record.get('Duration (mins)'),
                'Expiry (IST)': record.get('Expiry (IST)'),
                questions: questions
            };
            
            return res.status(200).json({ success: true, exam });
        }

        // Create new exam
        if (path === '/exams' && method === 'POST') {
            const { examCode, title, duration, expiry, questionIds } = req.body;
            
            if (!examCode || !title || !duration || !questionIds || questionIds.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'All fields are required and at least one question must be selected' 
                });
            }
            
            const airtableQuestionIds = [];
            for (const qId of questionIds) {
                const records = await base(QUESTIONS_TABLE).select({
                    filterByFormula: `{ID} = '${qId}'`,
                    maxRecords: 1
                }).firstPage();
                
                if (records.length > 0) {
                    airtableQuestionIds.push(records[0].id);
                }
            }
            
            const record = await base(EXAMS_TABLE).create([
                {
                    fields: {
                        'Exam Code': examCode,
                        'Title': title,
                        'Duration (mins)': parseInt(duration),
                        'Expiry (IST)': expiry,
                        'Questions': airtableQuestionIds
                    }
                }
            ]);
            
            return res.status(200).json({ 
                success: true, 
                message: 'Exam created successfully',
                exam: {
                    id: record[0].id,
                    'Exam Code': record[0].get('Exam Code'),
                    'Title': record[0].get('Title'),
                    'Duration (mins)': record[0].get('Duration (mins)'),
                    'Expiry (IST)': record[0].get('Expiry (IST)')
                }
            });
        }

        // Submit result
        if (path === '/results' && method === 'POST') {
            const { examCode, name, mobile, score, answers } = req.body;
            
            const examRecords = await base(EXAMS_TABLE).select({
                filterByFormula: `{Exam Code} = '${examCode}'`,
                maxRecords: 1
            }).firstPage();
            
            if (examRecords.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Exam not found' 
                });
            }
            
            const record = await base(RESULTS_TABLE).create([
                {
                    fields: {
                        'Timestamp': new Date().toISOString(),
                        'Exam': [examRecords[0].id],
                        'Name': name,
                        'Mobile': mobile || 'Not provided',
                        'Score': parseFloat(score),
                        'Answers': JSON.stringify(answers)
                    }
                }
            ]);
            
            return res.status(200).json({ 
                success: true, 
                message: 'Result submitted successfully',
                resultId: record[0].id
            });
        }

        // Get results for exam
        if (path.startsWith('/results/') && method === 'GET') {
            const examCode = path.replace('/results/', '');
            
            const examRecords = await base(EXAMS_TABLE).select({
                filterByFormula: `{Exam Code} = '${examCode}'`,
                maxRecords: 1
            }).firstPage();
            
            if (examRecords.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Exam not found' 
                });
            }
            
            const examRecordId = examRecords[0].id;
            
            const results = [];
            await base(RESULTS_TABLE).select({
                filterByFormula: `SEARCH('${examRecordId}', ARRAYJOIN({Exam}))`
            }).eachPage((records, fetchNextPage) => {
                records.forEach(record => {
                    results.push({
                        id: record.id,
                        Timestamp: record.get('Timestamp'),
                        Name: record.get('Name'),
                        Mobile: record.get('Mobile'),
                        Score: record.get('Score'),
                        Answers: record.get('Answers')
                    });
                });
                fetchNextPage();
            });
            
            return res.status(200).json({ success: true, results });
        }

        // Route not found
        return res.status(404).json({ 
            success: false, 
            error: 'Route not found' 
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
};
