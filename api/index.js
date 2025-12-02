const Airtable = require('airtable');
const crypto = require('crypto');

// =====================================================
// AIRTABLE CONFIGURATION
// =====================================================
const base = new Airtable({
    apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN
}).base(process.env.AIRTABLE_BASE_ID);

const QUESTIONS_TABLE = 'Questions';
const EXAMS_TABLE = 'Exams';
const RESULTS_TABLE = 'Results';

// =====================================================
// HIERARCHICAL QUESTION TYPE CONSTANTS
// =====================================================
const QUESTION_TYPES = {
    STANDALONE: 'Standalone',
    PARENT_CHILD: 'Parent-child'
};

// =====================================================
// SECURITY UTILITIES
// =====================================================
function sanitizeForFormula(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();
}

// =====================================================
// HIERARCHICAL QUESTION HELPER FUNCTIONS
// =====================================================

/**
 * Get all children of a parent question
 * @param {string} parentRecordId - Airtable record ID of parent
 * @returns {Promise<Array>} Array of child question records
 */
async function getChildQuestions(parentRecordId) {
    try {
        // Find all questions where Parent Question field contains this parent's record ID
        const records = await base(QUESTIONS_TABLE).select({
            filterByFormula: `SEARCH("${parentRecordId}", ARRAYJOIN({Parent Question}))`
        }).all();
        
        return records;
    } catch (error) {
        console.error('Error fetching child questions:', error);
        return [];
    }
}

/**
 * Check if a question is a parent (Parent-child type without parent link)
 */
function isParentQuestion(questionFields) {
    return questionFields['Question Type'] === QUESTION_TYPES.PARENT_CHILD && 
           !questionFields['Parent Question'];
}

/**
 * Cascade delete: Delete all children when parent is deleted
 * @param {string} parentRecordId - Airtable record ID of parent
 * @returns {Promise<number>} Number of children deleted
 */
async function cascadeDeleteChildren(parentRecordId) {
    try {
        const children = await getChildQuestions(parentRecordId);
        
        if (children.length === 0) {
            return 0;
        }

        // Airtable allows max 10 records per destroy call
        const childIds = children.map(child => child.id);
        let deletedCount = 0;
        
        for (let i = 0; i < childIds.length; i += 10) {
            const batch = childIds.slice(i, i + 10);
            await base(QUESTIONS_TABLE).destroy(batch);
            deletedCount += batch.length;
        }
        
        console.log(`🗑️ Cascade deleted ${deletedCount} child questions for parent ${parentRecordId}`);
        return deletedCount;
    } catch (error) {
        console.error('Error in cascade delete:', error);
        throw error;
    }
}

/**
 * Organize questions hierarchically (parents with their children)
 * @param {Array} questions - Flat array of all questions
 * @returns {Array} Hierarchically organized questions
 */
function organizeHierarchically(questions) {
    const parentQuestions = [];
    const childQuestionsMap = new Map();
    const standaloneQuestions = [];

    // First pass: categorize questions
    questions.forEach(q => {
        const questionType = q['Question Type'];
        const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
        
        if (questionType === QUESTION_TYPES.PARENT_CHILD && !hasParentLink) {
            // Parent-child type without parent link = parent question
            parentQuestions.push(q);
        } else if (questionType === QUESTION_TYPES.PARENT_CHILD && hasParentLink) {
            // Parent-child type with parent link = child question
            const parentId = q['Parent Question'][0]; // Record ID
            
            if (!childQuestionsMap.has(parentId)) {
                childQuestionsMap.set(parentId, []);
            }
            childQuestionsMap.get(parentId).push(q);
        } else {
            // Standalone questions (default)
            standaloneQuestions.push(q);
        }
    });

    // Sort children by Sub Question Number
    childQuestionsMap.forEach((children, parentId) => {
        children.sort((a, b) => {
            const numA = a['Sub Question Number'] || 0;
            const numB = b['Sub Question Number'] || 0;
            return numA - numB;
        });
    });

    // Attach children to parents
    const hierarchicalQuestions = parentQuestions.map(parent => {
        const children = childQuestionsMap.get(parent.id) || [];
        return {
            ...parent,
            children: children,
            childCount: children.length,
            isParent: true,
            totalScore: children.length // Each child is worth 1 point
        };
    });

    // Mark standalone questions
    const standaloneMarked = standaloneQuestions.map(q => ({
        ...q,
        children: [],
        childCount: 0,
        isParent: false,
        isStandalone: true
    }));

    // Return all questions: parents with children first, then standalones
    return [...hierarchicalQuestions, ...standaloneMarked];
}

// =====================================================
// MAIN REQUEST HANDLER
// =====================================================

        // =====================================================
        // RESULTS - GET BY EXAM CODE
        // =====================================================
        
        // GET /api/results/:examCode - Get results for an exam
        if (url.startsWith('/api/results/') && method === 'GET') {
            const examCode = url.split('/api/results/')[1];

            // Find exam first
            const examRecords = await base(EXAMS_TABLE).select({
                filterByFormula: `{Exam Code} = '${sanitizeForFormula(examCode)}'`
            }).all();

            if (examRecords.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Exam not found'
                });
            }

            const examId = examRecords[0].id;

            // Get all results for this exam
            const resultRecords = await base(RESULTS_TABLE).select({
                filterByFormula: `SEARCH('${examId}', ARRAYJOIN({Exam}))`
            }).all();

            const results = resultRecords.map(record => ({
                id: record.id,
                ...record.fields
            }));

            return res.status(200).json({
                success: true,
                data: results,
                count: results.length
            });
        }

        // =====================================================
        // STUDENT/CANDIDATE AUTHENTICATION & PROFILE
        // =====================================================
        
        // POST /api/auth/candidate/signup - Student signup
        if (url === '/api/auth/candidate/signup' && method === 'POST') {
            const { name, email, mobile, password } = req.body;

            // Validation
            if (!name || !email || !mobile || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'All fields are required (name, email, mobile, password)'
                });
            }

            if (mobile.length !== 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Mobile number must be 10 digits'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters'
                });
            }

            // Check if mobile or email already exists
            const existingRecords = await base('Candidates').select({
                filterByFormula: `OR({Mobile} = '${sanitizeForFormula(mobile)}', {Email} = '${sanitizeForFormula(email)}')`
            }).all();

            if (existingRecords.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Mobile number or email already registered'
                });
            }

            // Create new candidate
            const record = await base('Candidates').create({
                'Name': name,
                'Email': email,
                'Mobile': mobile,
                'Password': password
            });

            return res.status(201).json({
                success: true,
                data: {
                    id: record.id,
                    name: name,
                    email: email,
                    mobile: mobile
                },
                message: 'Account created successfully'
            });
        }

        // POST /api/auth/candidate/login - Student login with email/password
        if (url === '/api/auth/candidate/login' && method === 'POST') {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            // Find candidate
            const records = await base('Candidates').select({
                filterByFormula: `AND({Email} = '${sanitizeForFormula(email)}', {Password} = '${sanitizeForFormula(password)}')`
            }).all();

            if (records.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid email or password'
                });
            }

            const candidate = records[0].fields;

            return res.status(200).json({
                success: true,
                data: {
                    role: 'student',
                    id: records[0].id,
                    name: candidate.Name,
                    email: candidate.Email,
                    mobile: candidate.Mobile,
                    token: 'student_' + Date.now()
                },
                message: 'Login successful'
            });
        }

        // GET /api/candidates/profile/:email - Get candidate profile
        if (url.startsWith('/api/candidates/profile/') && method === 'GET') {
            const email = decodeURIComponent(url.split('/api/candidates/profile/')[1]);

            const records = await base('Candidates').select({
                filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
            }).all();

            if (records.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Candidate not found'
                });
            }

            const candidate = records[0].fields;

            return res.status(200).json({
                success: true,
                data: {
                    id: records[0].id,
                    name: candidate.Name,
                    email: candidate.Email,
                    mobile: candidate.Mobile
                }
            });
        }

        // GET /api/candidates/exams/:email - Get candidate exam history
        if (url.startsWith('/api/candidates/exams/') && method === 'GET') {
            const email = decodeURIComponent(url.split('/api/candidates/exams/')[1]);

            // Find candidate first
            const candidateRecords = await base('Candidates').select({
                filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
            }).all();

            if (candidateRecords.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Candidate not found'
                });
            }

            const candidateMobile = candidateRecords[0].fields.Mobile;

            // Get all results for this candidate
            const resultRecords = await base(RESULTS_TABLE).select({
                filterByFormula: `{Mobile} = '${sanitizeForFormula(candidateMobile)}'`
            }).all();

            const examHistory = resultRecords.map(record => ({
                id: record.id,
                examCode: record.fields['Exam Code'],
                timestamp: record.fields.Timestamp,
                score: record.fields.Score
            }));

            return res.status(200).json({
                success: true,
                data: {
                    examsGiven: examHistory.length,
                    exams: examHistory
                }
            });
        }

        // PUT /api/candidates/profile - Update candidate profile
        if (url === '/api/candidates/profile' && method === 'PUT') {
            const { email, name, mobile } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required to identify candidate'
                });
            }

            // Find candidate
            const records = await base('Candidates').select({
                filterByFormula: `{Email} = '${sanitizeForFormula(email)}'`
            }).all();

            if (records.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Candidate not found'
                });
            }

            const updateData = {};
            if (name) updateData.Name = name;
            if (mobile) updateData.Mobile = mobile;

            const updatedRecord = await base('Candidates').update(records[0].id, updateData);

            return res.status(200).json({
                success: true,
                data: {
                    id: updatedRecord.id,
                    ...updatedRecord.fields
                },
                message: 'Profile updated successfully'
            });
        }

        // PUT /api/candidates/password - Change candidate password
        if (url === '/api/candidates/password' && method === 'PUT') {
            const { email, currentPassword, newPassword } = req.body;

            if (!email || !currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Email, current password, and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters'
                });
            }

            // Verify current password
            const records = await base('Candidates').select({
                filterByFormula: `AND({Email} = '${sanitizeForFormula(email)}', {Password} = '${sanitizeForFormula(currentPassword)}')`
            }).all();

            if (records.length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'Current password is incorrect'
                });
            }

            // Update password
            await base('Candidates').update(records[0].id, {
                'Password': newPassword
            });

            return res.status(200).json({
                success: true,
                message: 'Password changed successfully'
            });
        }

        // =====================================================
        // EMAIL VERIFICATION (BASIC PLACEHOLDER)
        // =====================================================
        
        // GET /api/auth/verify/:token - Verify email
        if (url.startsWith('/api/auth/verify/') && method === 'GET') {
            const token = url.split('/api/auth/verify/')[1];

            // TODO: Implement actual token verification
            // For now, just return success
            return res.status(200).json({
                success: true,
                message: 'Email verified successfully'
            });
        }

        // POST /api/auth/resend-verification - Resend verification email
        if (url === '/api/auth/resend-verification' && method === 'POST') {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({
                    success: false,
                    error: 'Email is required'
                });
            }

            // TODO: Implement actual email sending
            return res.status(200).json({
                success: true,
                message: 'Verification email sent'
            });
        }

        // =====================================================
        // ADMIN UTILITIES
        // =====================================================
        
        // POST /api/questions/migrate - Migrate questions to new ID format
        if (url === '/api/questions/migrate' && method === 'POST') {
            const records = await base(QUESTIONS_TABLE).select().all();
            let migratedCount = 0;

            for (let i = 0; i < records.length; i++) {
                const record = records[i];
                
                // Check if ID needs migration (not in Q0001 format)
                const currentId = record.fields.ID;
                if (!currentId || !currentId.match(/^Q\\d{4}$/)) {
                    const newId = 'Q' + String(i + 1).padStart(4, '0');
                    await base(QUESTIONS_TABLE).update(record.id, {
                        'ID': newId
                    });
                    migratedCount++;
                }
            }

            return res.status(200).json({
                success: true,
                message: `Successfully migrated ${migratedCount} questions`,
                count: migratedCount
            });
        }

        // POST /api/admin/create-sample-exams - Create sample exams for testing
        if (url === '/api/admin/create-sample-exams' && method === 'POST') {
            // Create sample questions
            const sampleQuestions = [
                {
                    'ID': 'Q9001',
                    'Subject': 'Math',
                    'Question': 'What is 5 + 5?',
                    'Option A': '8',
                    'Option B': '10',
                    'Option C': '12',
                    'Option D': '15',
                    'Correct': 'B',
                    'Difficulty': 'Easy',
                    'Question Type': QUESTION_TYPES.STANDALONE
                },
                {
                    'ID': 'Q9002',
                    'Subject': 'Reasoning',
                    'Question': 'If A=1, B=2, C=3, what is the value of ABC?',
                    'Option A': '6',
                    'Option B': '123',
                    'Option C': 'ABC',
                    'Option D': '111',
                    'Correct': 'B',
                    'Difficulty': 'Easy',
                    'Question Type': QUESTION_TYPES.STANDALONE
                }
            ];

            const questionRecords = await base(QUESTIONS_TABLE).create(sampleQuestions);
            const questionIds = questionRecords.map(r => r.id);

            // Create sample exam
            const examData = {
                'Exam Code': 'DEMO001',
                'Title': 'Sample Demo Exam',
                'Duration (mins)': 30,
                'Questions': questionIds
            };

            const examRecord = await base(EXAMS_TABLE).create(examData);

            return res.status(201).json({
                success: true,
                message: 'Sample exams created successfully',
                data: {
                    questionsCreated: questionRecords.length,
                    examsCreated: 1,
                    exams: [{
                        code: 'DEMO001',
                        title: 'Sample Demo Exam',
                        questions: questionRecords.length
                    }]
                }
            });
        }

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { method } = req;
    
    // Normalize URL - strip query strings and trailing slashes
    let url = req.url;
    try {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        url = urlObj.pathname.replace(/\/+$/, '') || '/';
    } catch (e) {
        // If URL parsing fails, use raw URL
        url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
    }

    try {
        // =====================================================
        // HEALTH CHECK
        // =====================================================
        if (url === '/api/health' && method === 'GET') {
            const systemStatus = {
                airtable: { status: 'connected', message: 'Database connected' },
                gemini: { 
                    status: process.env.GEMINI_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.GEMINI_API_KEY ? 'AI service active' : 'API key not configured'
                },
                ocr: {
                    status: process.env.OCR_SPACE_API_KEY ? 'connected' : 'not_configured',
                    message: process.env.OCR_SPACE_API_KEY ? 'OCR service ready' : 'API key not configured'
                }
            };

            return res.status(200).json({
                status: 'ok',
                services: systemStatus,
                timestamp: new Date().toISOString()
            });
        }

        // =====================================================
        // QUESTION ENDPOINTS
        // =====================================================

        // GET /api/questions - List all questions (with hierarchical grouping option)
        if (url.startsWith('/api/questions') && method === 'GET') {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const hierarchical = urlObj.searchParams.get('hierarchical') === 'true';
            
            const records = await base(QUESTIONS_TABLE).select().all();
            const questions = records.map(record => ({
                id: record.id,
                ...record.fields
            }));

            if (hierarchical) {
                // Return hierarchically organized (parents with children)
                const organized = organizeHierarchically(questions);
                return res.status(200).json({
                    success: true,
                    data: organized,
                    count: organized.length,
                    totalQuestions: questions.length
                });
            } else {
                // Return flat list
                return res.status(200).json({
                    success: true,
                    data: questions,
                    count: questions.length
                });
            }
        }

        // POST /api/questions - Create new question
        if (url === '/api/questions' && method === 'POST') {
            const questionData = req.body;

            // Valid fields for Questions table
            const validFields = [
                'ID', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                'Correct', 'Difficulty', 'Question Type', 'Parent Question', 
                'Sub Question Number', 'Main Question Text'
            ];

            const cleanedData = {};
            for (const key of Object.keys(questionData)) {
                if (validFields.includes(key)) {
                    cleanedData[key] = questionData[key];
                }
            }

            // Auto-set Question Type if not provided
            if (!cleanedData['Question Type']) {
                // Check if it has Parent Question link
                if (cleanedData['Parent Question']) {
                    // Has parent link = child in parent-child relationship
                    cleanedData['Question Type'] = QUESTION_TYPES.PARENT_CHILD;
                } else {
                    // No parent link = standalone question (default)
                    cleanedData['Question Type'] = QUESTION_TYPES.STANDALONE;
                }
            }

            const record = await base(QUESTIONS_TABLE).create(cleanedData);
            return res.status(201).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // DELETE /api/questions/:id - Delete question WITH CASCADE for parent questions
        if (url.startsWith('/api/questions/') && method === 'DELETE') {
            const questionId = url.split('/api/questions/')[1];

            // Get the question record
            let questionRecord;
            try {
                questionRecord = await base(QUESTIONS_TABLE).find(questionId);
            } catch (e) {
                // If not found by record ID, try by field ID
                const records = await base(QUESTIONS_TABLE).select({
                    filterByFormula: `{ID} = '${sanitizeForFormula(questionId)}'`
                }).all();
                
                if (records.length > 0) {
                    questionRecord = records[0];
                }
            }

            if (!questionRecord) {
                return res.status(404).json({
                    success: false,
                    error: 'Question not found'
                });
            }

            const isParent = isParentQuestion(questionRecord.fields);
            const questionType = questionRecord.fields['Question Type'];
            let deletedChildCount = 0;

            // CASCADE DELETE: If parent, delete all children first
            if (isParent) {
                console.log(`🗑️ Deleting parent question: ${questionRecord.fields.ID || questionRecord.id}`);
                console.log(`   Type: ${questionType}`);
                console.log(`   Checking for children...`);
                
                deletedChildCount = await cascadeDeleteChildren(questionRecord.id);
                
                if (deletedChildCount > 0) {
                    console.log(`✅ Successfully cascade deleted ${deletedChildCount} child questions`);
                }
            }

            // Delete the main question (parent or standalone)
            await base(QUESTIONS_TABLE).destroy(questionRecord.id);

            const message = deletedChildCount > 0
                ? `Parent question and ${deletedChildCount} child question(s) deleted successfully`
                : 'Question deleted successfully';

            return res.status(200).json({
                success: true,
                message: message,
                deleted: {
                    questionId: questionRecord.id,
                    fieldId: questionRecord.fields.ID,
                    questionType: questionType,
                    childrenDeleted: deletedChildCount
                }
            });
        }

        // PUT /api/questions/:id - Update question
        if (url.startsWith('/api/questions/') && method === 'PUT') {
            const questionId = url.split('/api/questions/')[1];
            const updateData = req.body;

            const validFields = [
                'ID', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                'Correct', 'Difficulty', 'Question Type', 'Parent Question', 
                'Sub Question Number', 'Main Question Text'
            ];

            const cleanedData = {};
            for (const key of Object.keys(updateData)) {
                if (validFields.includes(key)) {
                    cleanedData[key] = updateData[key];
                }
            }

            const record = await base(QUESTIONS_TABLE).update(questionId, cleanedData);
            return res.status(200).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // POST /api/questions/bulk - Bulk create questions (with hierarchy support)
        if (url === '/api/questions/bulk' && method === 'POST') {
            const { questions } = req.body;

            if (!Array.isArray(questions) || questions.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid request. Provide an array of questions.'
                });
            }

            const validFields = [
                'ID', 'Subject', 'Question', 'Option A', 'Option B', 'Option C', 'Option D',
                'Correct', 'Difficulty', 'Question Type', 'Parent Question', 
                'Sub Question Number', 'Main Question Text'
            ];

            const cleanedQuestions = questions.map(q => {
                const cleaned = {};
                for (const key of Object.keys(q)) {
                    if (validFields.includes(key)) {
                        cleaned[key] = q[key];
                    }
                }

                // Auto-set Question Type if not provided
                if (!cleaned['Question Type']) {
                    if (cleaned['Parent Question']) {
                        // Has parent link = child in parent-child relationship
                        cleaned['Question Type'] = QUESTION_TYPES.PARENT_CHILD;
                    } else {
                        // No parent link = standalone (default)
                        cleaned['Question Type'] = QUESTION_TYPES.STANDALONE;
                    }
                }

                return cleaned;
            });

            // Create in batches of 10 (Airtable limit)
            const results = [];
            for (let i = 0; i < cleanedQuestions.length; i += 10) {
                const batch = cleanedQuestions.slice(i, i + 10);
                const records = await base(QUESTIONS_TABLE).create(batch);
                results.push(...records);
            }

            return res.status(201).json({
                success: true,
                message: `Successfully created ${results.length} questions`,
                count: results.length,
                data: results.map(r => ({ id: r.id, ...r.fields }))
            });
        }

        // =====================================================
        // EXAM ENDPOINTS (with hierarchical support)
        // =====================================================

        // GET /api/exams - List all exams
        if (url === '/api/exams' && method === 'GET') {
            const records = await base(EXAMS_TABLE).select().all();
            const exams = records.map(record => ({
                id: record.id,
                ...record.fields
            }));

            return res.status(200).json({
                success: true,
                data: exams
            });
        }

        // GET /api/exams/:code - Get exam by code (with hierarchical questions)
        if (url.startsWith('/api/exams/') && method === 'GET') {
            const examCode = url.split('/api/exams/')[1];

            const records = await base(EXAMS_TABLE).select({
                filterByFormula: `{Exam Code} = '${sanitizeForFormula(examCode)}'`
            }).all();

            if (records.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Exam not found'
                });
            }

            const exam = records[0];
            const examData = {
                id: exam.id,
                ...exam.fields
            };

            // Get questions for this exam (hierarchically organized)
            if (examData.Questions && examData.Questions.length > 0) {
                const questionRecords = await Promise.all(
                    examData.Questions.map(qId => base(QUESTIONS_TABLE).find(qId))
                );

                const questions = questionRecords.map(r => ({
                    id: r.id,
                    ...r.fields
                }));

                // Organize hierarchically
                examData.questionData = organizeHierarchically(questions);
            }

            return res.status(200).json({
                success: true,
                data: examData
            });
        }

        // POST /api/exams - Create new exam
        if (url === '/api/exams' && method === 'POST') {
            const examData = req.body;

            // Handle question IDs field
            if (examData.questionIds && !examData.Questions) {
                examData.Questions = examData.questionIds;
            }

            const validFields = ['Exam Code', 'Title', 'Duration (mins)', 'Expiry (IST)', 'Questions'];
            const cleanedData = {};
            
            for (const key of Object.keys(examData)) {
                if (validFields.includes(key)) {
                    cleanedData[key] = examData[key];
                }
            }

            const record = await base(EXAMS_TABLE).create(cleanedData);
            return res.status(201).json({
                success: true,
                data: { id: record.id, ...record.fields }
            });
        }

        // =====================================================
        // RESULTS ENDPOINTS (with hierarchical scoring)
        // =====================================================

        // POST /api/results - Submit exam results (handles hierarchical scoring)
        if (url === '/api/results' && method === 'POST') {
            const resultData = req.body;

            // Calculate score (handles parent-child questions)
            let totalScore = 0;
            
            if (resultData.answers) {
                const answers = JSON.parse(resultData.answers);
                
                // Get all questions for this exam
                const examRecords = await base(EXAMS_TABLE).select({
                    filterByFormula: `{Exam Code} = '${sanitizeForFormula(resultData.examCode)}'`
                }).all();

                if (examRecords.length > 0) {
                    const exam = examRecords[0];
                    
                    if (exam.fields.Questions) {
                        const questionRecords = await Promise.all(
                            exam.fields.Questions.map(qId => base(QUESTIONS_TABLE).find(qId))
                        );

                        questionRecords.forEach(qRecord => {
                            const q = qRecord.fields;
                            const questionType = q['Question Type'];
                            const hasParentLink = q['Parent Question'] && q['Parent Question'].length > 0;
                            
                            // Only score actual questions with options
                            // Standalone questions OR child questions in parent-child relationship
                            const shouldScore = questionType === QUESTION_TYPES.STANDALONE || 
                                              (questionType === QUESTION_TYPES.PARENT_CHILD && hasParentLink);
                            
                            if (shouldScore) {
                                const userAnswer = answers[q.ID];
                                const correctAnswer = q.Correct || q['Correct Answer'];

                                if (userAnswer === correctAnswer) {
                                    totalScore += 1; // +1 for correct
                                } else if (userAnswer && userAnswer !== 'unanswered') {
                                    totalScore -= 0.25; // -0.25 for incorrect
                                }
                                // 0 for unanswered
                            }
                        });
                    }
                }
            }

            // Create result record
            const record = await base(RESULTS_TABLE).create({
                'Timestamp': new Date().toISOString(),
                'Exam': resultData.examId ? [resultData.examId] : undefined,
                'Name': resultData.name,
                'Mobile': resultData.mobile,
                'Score': totalScore,
                'Answers': resultData.answers
            });

            return res.status(201).json({
                success: true,
                data: {
                    id: record.id,
                    score: totalScore,
                    ...record.fields
                }
            });
        }

        // =====================================================
        // AUTHENTICATION ENDPOINTS
        // =====================================================

        // POST /api/auth/admin/login - Admin login
        if (url === '/api/auth/admin/login' && method === 'POST') {
            const { username, password } = req.body;

            // Admin authentication - use environment variables or hardcoded default
            const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
            const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'politeadmin';

            if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                return res.status(200).json({
                    success: true,
                    data: {
                        role: 'admin',
                        username: username,
                        token: 'admin_' + Date.now()
                    },
                    message: 'Login successful'
                });
            } else {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }
        }

        // POST /api/auth/student/login - Student login
        if (url === '/api/auth/student/login' && method === 'POST') {
            const { mobile } = req.body;

            if (!mobile || mobile.length !== 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid mobile number (must be 10 digits)'
                });
            }

            // Validate student exists in database (optional - can add later)
            // For now, accept any 10-digit mobile number
            return res.status(200).json({
                success: true,
                data: {
                    role: 'student',
                    mobile: mobile,
                    token: 'student_' + Date.now()
                },
                message: 'Login successful'
            });
        }

        // POST /api/auth/reset-password - Reset password
        if (url === '/api/auth/reset-password' && method === 'POST') {
            const { mobile, newPassword } = req.body;

            if (!mobile || mobile.length !== 10) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid mobile number (must be 10 digits)'
                });
            }

            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'Password must be at least 6 characters'
                });
            }

            // TODO: In a real system, you would:
            // 1. Verify mobile number exists in Students table
            // 2. Send OTP for verification
            // 3. Update password in database
            // For now, just return success
            return res.status(200).json({
                success: true,
                message: 'Password reset successful. You can now login with your new password.'
            });
        }

        // =====================================================
        // DEFAULT - 404
        // =====================================================
        return res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
