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
const CANDIDATES_TABLE = 'Candidates';

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

                // Get question IDs value
                const questionIdsValue = examData['Question IDs'] || examData['questionIds'] || examData['Questions'];

                // Try different possible field name variations for Question IDs
                // Airtable might use: "Question IDs", "Questions", "QuestionIDs", etc.
                const fieldVariations = [
                    'Question IDs',
                    'Questions',
                    'QuestionIDs',
                    'questionIds',
                    'question_ids'
                ];

                let lastError = null;

                // Try each field name variation
                for (const fieldName of fieldVariations) {
                    try {
                        const mappedData = {
                            'Exam Code': examData['Exam Code'],
                            'Title': examData['Title'],
                            'Duration (mins)': examData['Duration (mins)'],
                            'Expiry (IST)': examData['Expiry (IST)'],
                            [fieldName]: questionIdsValue
                        };

                        console.log(`Attempting to create exam with field name: "${fieldName}"`);
                        console.log('Data:', JSON.stringify(mappedData, null, 2));

                        const record = await base(EXAMS_TABLE).create(mappedData);

                        console.log(`✅ Success! Correct field name is: "${fieldName}"`);

                        return res.status(201).json({
                            success: true,
                            data: { id: record.id, ...record.fields }
                        });
                    } catch (err) {
                        lastError = err;
                        console.log(`❌ Failed with field name "${fieldName}":`, err.message);

                        // If this is not a field name error, throw immediately
                        if (!err.message.includes('Unknown field') && !err.message.includes('unknown field')) {
                            throw err;
                        }
                        // Otherwise, continue to next variation
                    }
                }

                // If all variations failed, throw the last error
                throw new Error(`Failed to create exam. Tried field names: ${fieldVariations.join(', ')}. Last error: ${lastError.message}`);

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

            // Auto-create candidate record if it doesn't exist (requirement #9)
            if (resultData.Name && resultData.Mobile) {
                try {
                    // Check if candidate already exists
                    const existingCandidates = await base(CANDIDATES_TABLE)
                        .select({
                            filterByFormula: `AND({Name} = '${resultData.Name}', {Mobile} = '${resultData.Mobile}')`
                        })
                        .all();

                    // Create candidate if doesn't exist
                    if (existingCandidates.length === 0) {
                        await base(CANDIDATES_TABLE).create({
                            'Name': resultData.Name,
                            'Mobile': resultData.Mobile,
                            'First Exam Date': new Date().toISOString()
                        });
                        console.log(`✅ Created new candidate: ${resultData.Name} (${resultData.Mobile})`);
                    }
                } catch (candidateError) {
                    console.error('Warning: Could not create candidate record:', candidateError);
                    // Continue anyway - don't fail result submission if candidate creation fails
                }
            }

            // Create the result record
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

            // Try different field name variations for linked records
            const fieldVariations = [
                `{Exam}`,  // Direct linked field name
                `{Exam (from Exam)}`,  // Rollup/lookup field
                `ARRAYJOIN({Exam})`,  // Array join for linked records
            ];

            let resultRecords = [];
            let lastError = null;

            // Try filtering by linked record field
            for (const fieldFormula of fieldVariations) {
                try {
                    resultRecords = await base(RESULTS_TABLE)
                        .select({
                            filterByFormula: `FIND('${examId}', ${fieldFormula})`
                        })
                        .all();

                    // If we got results, break
                    if (resultRecords.length > 0) {
                        break;
                    }
                } catch (err) {
                    lastError = err;
                    console.log(`Failed with formula: FIND('${examId}', ${fieldFormula})`, err.message);
                }
            }

            // If linked field filtering didn't work, fall back to filtering by Exam Code
            if (resultRecords.length === 0) {
                try {
                    resultRecords = await base(RESULTS_TABLE)
                        .select({
                            filterByFormula: `{Exam Code} = '${examCode}'`
                        })
                        .all();
                } catch (err) {
                    console.log('Failed to filter by Exam Code:', err.message);
                }
            }

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

        // POST /api/admin/create-sample-exams - Create sample exams with questions
        if (url === '/api/admin/create-sample-exams' && method === 'POST') {
            try {
                // Sample questions for different subjects
                const SAMPLE_QUESTIONS = [
                    // Math Questions
                    { ID: 'Q0001', Subject: 'Math', Question: 'What is 15 × 8?', 'Option A': '100', 'Option B': '120', 'Option C': '140', 'Option D': '160', Correct: 'B' },
                    { ID: 'Q0002', Subject: 'Math', Question: 'What is the value of √144?', 'Option A': '10', 'Option B': '11', 'Option C': '12', 'Option D': '13', Correct: 'C' },
                    { ID: 'Q0003', Subject: 'Math', Question: 'What is 25% of 200?', 'Option A': '25', 'Option B': '50', 'Option C': '75', 'Option D': '100', Correct: 'B' },
                    { ID: 'Q0004', Subject: 'Math', Question: 'If x + 7 = 15, what is the value of x?', 'Option A': '6', 'Option B': '7', 'Option C': '8', 'Option D': '9', Correct: 'C' },
                    { ID: 'Q0005', Subject: 'Math', Question: 'What is the area of a rectangle with length 12 cm and width 8 cm?', 'Option A': '20 sq cm', 'Option B': '40 sq cm', 'Option C': '96 sq cm', 'Option D': '120 sq cm', Correct: 'C' },

                    // General Knowledge Questions
                    { ID: 'Q0006', Subject: 'General Knowledge', Question: 'What is the capital of India?', 'Option A': 'New Delhi', 'Option B': 'Mumbai', 'Option C': 'Kolkata', 'Option D': 'Chennai', Correct: 'A' },
                    { ID: 'Q0007', Subject: 'General Knowledge', Question: 'Who is known as the Father of the Nation in India?', 'Option A': 'Jawaharlal Nehru', 'Option B': 'Mahatma Gandhi', 'Option C': 'Subhas Chandra Bose', 'Option D': 'Sardar Patel', Correct: 'B' },
                    { ID: 'Q0008', Subject: 'General Knowledge', Question: 'Which is the largest planet in our solar system?', 'Option A': 'Earth', 'Option B': 'Mars', 'Option C': 'Jupiter', 'Option D': 'Saturn', Correct: 'C' },
                    { ID: 'Q0009', Subject: 'General Knowledge', Question: 'How many continents are there in the world?', 'Option A': '5', 'Option B': '6', 'Option C': '7', 'Option D': '8', Correct: 'C' },
                    { ID: 'Q0010', Subject: 'General Knowledge', Question: 'What is the national animal of India?', 'Option A': 'Lion', 'Option B': 'Tiger', 'Option C': 'Elephant', 'Option D': 'Peacock', Correct: 'B' },

                    // Reasoning Questions
                    { ID: 'Q0011', Subject: 'Reasoning', Question: 'If CAT is coded as 3120, then DOG would be coded as:', 'Option A': '4157', 'Option B': '41507', 'Option C': '4-15-7', 'Option D': '4-15-07', Correct: 'A' },
                    { ID: 'Q0012', Subject: 'Reasoning', Question: 'Complete the series: 2, 6, 12, 20, 30, ?', 'Option A': '40', 'Option B': '42', 'Option C': '44', 'Option D': '46', Correct: 'B' },
                    { ID: 'Q0013', Subject: 'Reasoning', Question: 'Which number is the odd one out: 3, 5, 7, 9, 12, 13?', 'Option A': '3', 'Option B': '7', 'Option C': '12', 'Option D': '13', Correct: 'C' },
                    { ID: 'Q0014', Subject: 'Reasoning', Question: 'If all roses are flowers and all flowers are plants, then:', 'Option A': 'All plants are roses', 'Option B': 'All roses are plants', 'Option C': 'Some plants are flowers', 'Option D': 'No conclusion', Correct: 'B' },
                    { ID: 'Q0015', Subject: 'Reasoning', Question: 'Find the missing number: 5, 10, 20, 40, ?, 160', 'Option A': '60', 'Option B': '70', 'Option C': '80', 'Option D': '90', Correct: 'C' },

                    // English Questions
                    { ID: 'Q0016', Subject: 'English', Question: 'Choose the correct synonym of "Abundant":', 'Option A': 'Scarce', 'Option B': 'Plentiful', 'Option C': 'Limited', 'Option D': 'Rare', Correct: 'B' },
                    { ID: 'Q0017', Subject: 'English', Question: 'Identify the correctly spelled word:', 'Option A': 'Occassion', 'Option B': 'Occasion', 'Option C': 'Ocassion', 'Option D': 'Ocasion', Correct: 'B' },
                    { ID: 'Q0018', Subject: 'English', Question: 'What is the antonym of "Ancient"?', 'Option A': 'Old', 'Option B': 'Modern', 'Option C': 'Historic', 'Option D': 'Traditional', Correct: 'B' },
                    { ID: 'Q0019', Subject: 'English', Question: 'Choose the correct sentence:', 'Option A': 'She don\'t like apples', 'Option B': 'She doesn\'t likes apples', 'Option C': 'She doesn\'t like apples', 'Option D': 'She don\'t likes apples', Correct: 'C' },
                    { ID: 'Q0020', Subject: 'English', Question: 'What is the plural of "Child"?', 'Option A': 'Childs', 'Option B': 'Childes', 'Option C': 'Children', 'Option D': 'Childrens', Correct: 'C' }
                ];

                // Check if questions already exist
                const existingQuestions = await base(QUESTIONS_TABLE).select({ maxRecords: 1 }).all();
                let createdQuestions = [];

                if (existingQuestions.length === 0) {
                    // Create questions in batches of 10
                    const batchSize = 10;
                    for (let i = 0; i < SAMPLE_QUESTIONS.length; i += batchSize) {
                        const batch = SAMPLE_QUESTIONS.slice(i, i + batchSize);
                        const records = await base(QUESTIONS_TABLE).create(batch.map(q => ({ fields: q })));
                        createdQuestions.push(...records);
                    }
                }

                // Get question record IDs
                const questionMap = {};
                for (const q of SAMPLE_QUESTIONS) {
                    const records = await base(QUESTIONS_TABLE)
                        .select({ filterByFormula: `{ID} = '${q.ID}'`, maxRecords: 1 })
                        .all();
                    if (records.length > 0) {
                        questionMap[q.ID] = records[0].id;
                    }
                }

                // Create exams
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + 7);
                const expiryIST = expiryDate.toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                const SAMPLE_EXAMS = [
                    { 'Exam Code': 'MATH_BASICS_01', Title: 'Basic Mathematics Test', 'Duration (mins)': 15, questionIds: ['Q0001', 'Q0002', 'Q0003', 'Q0004', 'Q0005'] },
                    { 'Exam Code': 'GK_TEST_01', Title: 'General Knowledge Assessment', 'Duration (mins)': 10, questionIds: ['Q0006', 'Q0007', 'Q0008', 'Q0009', 'Q0010'] },
                    { 'Exam Code': 'REASONING_01', Title: 'Logical Reasoning Test', 'Duration (mins)': 12, questionIds: ['Q0011', 'Q0012', 'Q0013', 'Q0014', 'Q0015'] },
                    { 'Exam Code': 'ENGLISH_01', Title: 'English Language Test', 'Duration (mins)': 10, questionIds: ['Q0016', 'Q0017', 'Q0018', 'Q0019', 'Q0020'] },
                    { 'Exam Code': 'MIXED_TEST_01', Title: 'Mixed Subject Assessment', 'Duration (mins)': 20, questionIds: ['Q0001', 'Q0006', 'Q0011', 'Q0016', 'Q0003', 'Q0008', 'Q0013', 'Q0018', 'Q0005', 'Q0010'] }
                ];

                const createdExams = [];
                for (const exam of SAMPLE_EXAMS) {
                    const questionRecordIds = exam.questionIds.map(qId => questionMap[qId]).filter(id => id);

                    const examData = {
                        'Exam Code': exam['Exam Code'],
                        'Title': exam.Title,
                        'Duration (mins)': exam['Duration (mins)'],
                        'Expiry (IST)': expiryIST,
                        'Question IDs': questionRecordIds
                    };

                    const record = await base(EXAMS_TABLE).create(examData);
                    createdExams.push(record);
                }

                return res.status(201).json({
                    success: true,
                    message: 'Sample exams created successfully',
                    data: {
                        questionsCreated: createdQuestions.length,
                        examsCreated: createdExams.length,
                        exams: SAMPLE_EXAMS.map(e => ({
                            code: e['Exam Code'],
                            title: e.Title,
                            questions: e.questionIds.length
                        }))
                    }
                });

            } catch (error) {
                console.error('Sample creation error:', error);
                return res.status(500).json({
                    success: false,
                    error: error.message || 'Failed to create sample exams'
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
