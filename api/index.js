const Airtable = require('airtable');

// =====================================================
// AIRTABLE CONFIGURATION
// =====================================================
// IMPORTANT: This uses Airtable Personal Access Token
// Your token should start with "pat" (e.g., patXXXXXXXXXXXXXX)
// 
// Set this environment variable in Vercel:
// AIRTABLE_PERSONAL_ACCESS_TOKEN = your_token_here
// =====================================================

const base = new Airtable({ 
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

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

    try {
        // Health check with system status
        if (url === '/api/health') {
            const systemStatus = {
                airtable: {
                    status: 'connected',
                    message: 'Airtable database connected'
                },
                gemini: {
                    status: process.env.GEMINI_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.GEMINI_API_KEY ? 'Gemini AI ready' : 'API key not configured'
                },
                ocr: {
                    status: process.env.OCR_SPACE_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.OCR_SPACE_API_KEY ? 'OCR service ready' : 'API key not configured'
                }
            };
            
            return res.status(200).json({ 
                status: 'ok', 
                message: 'System health check',
                services: systemStatus,
                timestamp: new Date().toISOString()
            });
        }

        // GET /api/questions - List all questions
        if (url === '/api/questions' && method === 'GET') {
            const records = await base(QUESTIONS_TABLE).select().all();
            const questions = records.map(record => ({
                id: record.id,
                ...record.fields
            }));
            return res.status(200).json({ success: true, data: questions });
        }

        // POST /api/questions - Create new question
        if (url === '/api/questions' && method === 'POST') {
            const questionData = req.body;
            const record = await base(QUESTIONS_TABLE).create(questionData);
            return res.status(201).json({ 
                success: true, 
                data: { id: record.id, ...record.fields } 
            });
        }

        // DELETE /api/questions/:id - Delete question
        if (url.startsWith('/api/questions/') && method === 'DELETE') {
            const questionId = url.split('/api/questions/')[1];
            await base(QUESTIONS_TABLE).destroy(questionId);
            return res.status(200).json({ 
                success: true, 
                message: 'Question deleted successfully' 
            });
        }

        // GET /api/exams - List all exams
        if (url === '/api/exams' && method === 'GET') {
            const records = await base(EXAMS_TABLE).select().all();
            const exams = records.map(record => ({
                id: record.id,
                ...record.fields
            }));
            return res.status(200).json({ success: true, data: exams });
        }

        // POST /api/exams - Create new exam
        if (url === '/api/exams' && method === 'POST') {
            const examData = req.body;
            const record = await base(EXAMS_TABLE).create(examData);
            return res.status(201).json({ 
                success: true, 
                data: { id: record.id, ...record.fields } 
            });
        }

        // GET /api/exams/:code - Get exam by code
        if (url.startsWith('/api/exams/') && method === 'GET') {
            const examCode = url.split('/api/exams/')[1];
            const records = await base(EXAMS_TABLE)
                .select({
                    filterByFormula: `{Exam Code} = '${examCode}'`
                })
                .all();
            
            if (records.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Exam not found' 
                });
            }
            
            const exam = {
                id: records[0].id,
                ...records[0].fields
            };
            
            return res.status(200).json({ success: true, data: exam });
        }

        // POST /api/results - Create new result
        if (url === '/api/results' && method === 'POST') {
            const resultData = req.body;
            const record = await base(RESULTS_TABLE).create(resultData);
            return res.status(201).json({ 
                success: true, 
                data: { id: record.id, ...record.fields } 
            });
        }

        // GET /api/results/:examCode - Get results by exam code
        if (url.startsWith('/api/results/') && method === 'GET') {
            const examCode = url.split('/api/results/')[1];
            
            // First get the exam record
            const examRecords = await base(EXAMS_TABLE)
                .select({
                    filterByFormula: `{Exam Code} = '${examCode}'`
                })
                .all();
            
            if (examRecords.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Exam not found' 
                });
            }
            
            const examId = examRecords[0].id;
            
            // Get results linked to this exam
            const resultRecords = await base(RESULTS_TABLE)
                .select({
                    filterByFormula: `FIND('${examId}', {Exam (from Exam)})`
                })
                .all();
            
            const results = resultRecords.map(record => ({
                id: record.id,
                ...record.fields
            }));
            
            return res.status(200).json({ success: true, data: results });
        }

        // 404 - Route not found
        return res.status(404).json({ 
            success: false, 
            error: 'Route not found' 
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message || 'Internal server error' 
        });
    }
};
