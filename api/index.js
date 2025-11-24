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

        // PUT /api/questions/:id - Update question
        if (url.startsWith('/api/questions/') && method === 'PUT') {
            const questionId = url.split('/api/questions/')[1];
            const updateData = req.body;
            const record = await base(QUESTIONS_TABLE).update(questionId, updateData);
            return res.status(200).json({
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

        // POST /api/questions/migrate - Migrate all questions to new ID format (Q0001, Q0002, etc.)
        if (url === '/api/questions/migrate' && method === 'POST') {
            try {
                // Get all questions
                const records = await base(QUESTIONS_TABLE).select().all();

                // Sort by current ID to maintain order
                const sortedRecords = records.sort((a, b) => {
                    const idA = a.fields.ID || '';
                    const idB = b.fields.ID || '';

                    // Extract numbers from IDs
                    const matchA = idA.match(/^[qQ](\d+)$/);
                    const matchB = idB.match(/^[qQ](\d+)$/);
                    const numA = matchA ? parseInt(matchA[1]) : 0;
                    const numB = matchB ? parseInt(matchB[1]) : 0;

                    return numA - numB;
                });

                // Update each question with new format
                const updates = [];
                for (let i = 0; i < sortedRecords.length; i++) {
                    const record = sortedRecords[i];
                    const newId = 'Q' + String(i + 1).padStart(4, '0');

                    updates.push({
                        id: record.id,
                        fields: {
                            ID: newId
                        }
                    });
                }

                // Batch update (Airtable allows up to 10 records per batch)
                const batchSize = 10;
                for (let i = 0; i < updates.length; i += batchSize) {
                    const batch = updates.slice(i, i + batchSize);
                    await base(QUESTIONS_TABLE).update(batch);
                }

                return res.status(200).json({
                    success: true,
                    message: `Successfully migrated ${updates.length} questions to new format`,
                    count: updates.length
                });
            } catch (error) {
                console.error('Migration error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
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
            try {
                const examData = req.body;

                // Map frontend field names to Airtable field names
                // Airtable might expect different field naming
                const mappedData = {
                    'Exam Code': examData['Exam Code'],
                    'Title': examData['Title'],
                    'Duration (mins)': examData['Duration (mins)'],
                    'Expiry (IST)': examData['Expiry (IST)'],
                    // Try both possible field names for question IDs
                    'Question IDs': examData['Question IDs'] || examData['questionIds']
                };

                console.log('Creating exam with data:', JSON.stringify(mappedData, null, 2));

                const record = await base(EXAMS_TABLE).create(mappedData);
                return res.status(201).json({
                    success: true,
                    data: { id: record.id, ...record.fields }
                });
            } catch (error) {
                console.error('Error creating exam:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to create exam'
                });
            }
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

        // POST /api/gemini/extract-questions - Extract questions from image using Gemini Vision
        if (url === '/api/gemini/extract-questions' && method === 'POST') {
            try {
                const { imageData } = req.body;

                if (!process.env.GEMINI_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Gemini API key not configured'
                    });
                }

                if (!imageData) {
                    return res.status(400).json({
                        success: false,
                        error: 'Image data is required'
                    });
                }

                // Call Gemini Vision API with latest model
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    {
                                        text: `You are an expert question extraction system. Extract ALL questions from this image with their options and identify the correct answer.

IMPORTANT INSTRUCTIONS:
1. Extract EVERY question you see in the image
2. Look for visual cues for correct answers: bold text, underlined text, checkmarks, circles, or any other marking
3. If you cannot identify the correct answer from visual cues, analyze the content and make your best determination
4. Return the data in this EXACT JSON format:

{
  "questions": [
    {
      "question": "Full question text here",
      "optionA": "First option",
      "optionB": "Second option",
      "optionC": "Third option",
      "optionD": "Fourth option",
      "correct": "A or B or C or D (the letter of correct answer)",
      "subject": "Math or GK or Reasoning or Others"
    }
  ]
}

Extract ALL questions you can find. Return ONLY valid JSON, no other text.`
                                    },
                                    {
                                        inline_data: {
                                            mime_type: imageData.mimeType || 'image/jpeg',
                                            data: imageData.base64.split(',')[1] || imageData.base64
                                        }
                                    }
                                ]
                            }]
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gemini API request failed');
                }

                // Extract text from Gemini response
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Parse JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No valid JSON found in response');
                }

                const extractedData = JSON.parse(jsonMatch[0]);

                return res.status(200).json({
                    success: true,
                    data: extractedData
                });

            } catch (error) {
                console.error('Gemini extraction error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to extract questions'
                });
            }
        }

        // POST /api/gemini/generate-question - Generate a question using Gemini AI
        if (url === '/api/gemini/generate-question' && method === 'POST') {
            try {
                const { subject, difficulty, customPrompt } = req.body;

                if (!process.env.GEMINI_API_KEY) {
                    return res.status(500).json({
                        success: false,
                        error: 'Gemini API key not configured'
                    });
                }

                // Build the prompt
                let prompt = '';
                if (customPrompt && customPrompt.trim()) {
                    prompt = `Generate a multiple choice question based on this request: "${customPrompt}"`;
                } else {
                    const difficultyText = difficulty || 'medium';
                    prompt = `Generate a ${difficultyText} difficulty multiple choice question for ${subject || 'General Knowledge'} topic suitable for competitive exams like Railway, Banking, SSC, etc.`;
                }

                prompt += `\n\nReturn ONLY valid JSON in this EXACT format (no other text):
{
  "question": "The complete question text",
  "optionA": "First option",
  "optionB": "Second option",
  "optionC": "Third option",
  "optionD": "Fourth option",
  "correct": "A or B or C or D",
  "explanation": "Brief explanation of the correct answer",
  "subject": "${subject || 'Others'}",
  "difficulty": "${difficulty || 'medium'}"
}

Make sure the question is unique, relevant, and has one clearly correct answer.`;

                // Call Gemini API with latest model
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: prompt
                                }]
                            }]
                        })
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gemini API request failed');
                }

                // Extract text from Gemini response
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

                // Parse JSON from response
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No valid JSON found in response');
                }

                const questionData = JSON.parse(jsonMatch[0]);

                return res.status(200).json({
                    success: true,
                    data: questionData
                });

            } catch (error) {
                console.error('Gemini generation error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to generate question'
                });
            }
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
